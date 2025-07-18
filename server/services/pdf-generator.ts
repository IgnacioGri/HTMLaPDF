import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage.js';
import type { PdfConfig } from '../../shared/schema.js';
import { createRequire } from 'module';
import { validateHtml, sanitizeHtml } from './html-validation.js';
import { startJobTimeout, clearJobTimeout, completeJob } from './job-timeout-manager.js';
const require = createRequire(import.meta.url);
const htmlPdf = require('html-pdf-node');

const PDF_OUTPUT_DIR = './generated-pdfs';

export async function generatePdf(htmlContent: string, config: PdfConfig, jobId: number): Promise<string> {
  let browser;
  
  try {
    // Ensure output directory exists
    await fs.mkdir(PDF_OUTPUT_DIR, { recursive: true });
    
    // Start job timeout monitoring
    startJobTimeout(jobId);
    
    // Update job status to processing
    await storage.updateConversionJobStatus(jobId, "processing");
    
    console.log('Environment:', process.env.NODE_ENV);
    console.log('HTML content size:', htmlContent.length, 'characters');
    
    // Validate HTML before processing
    const validation = validateHtml(htmlContent);
    if (!validation.isValid) {
      console.log('HTML validation warnings:', validation.errors);
      // Continue but sanitize the content
      htmlContent = sanitizeHtml(htmlContent);
    }
    
    // Set timeout based on content size - larger files need more time
    const contentSizeKB = htmlContent.length / 1024;
    const baseTimeout = 30000; // 30 seconds base
    const dynamicTimeout = Math.min(120000, baseTimeout + (contentSizeKB * 100)); // Max 2 minutes
    console.log('Dynamic timeout set to:', dynamicTimeout, 'ms for', Math.round(contentSizeKB), 'KB content');
    
    // Optimize HTML for large files
    let optimizedHtml = htmlContent;
    if (contentSizeKB > 500) { // If file is larger than 500KB
      console.log('Optimizing large HTML content...');
      // Remove unnecessary CSS and JavaScript that might slow down processing
      optimizedHtml = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/style="[^"]*"/gi, '') // Remove inline styles that conflict
        .replace(/class="ql-[^"]*"/gi, 'class=""') // Simplify Quill editor classes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      console.log('HTML optimized from', Math.round(contentSizeKB), 'KB to', Math.round(optimizedHtml.length / 1024), 'KB');
    }

    // Inject custom styles for Cohen reports
    const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${generateCustomCSS(config)}
      </style>
    </head>
    <body>
      ${optimizedHtml}
    </body>
    </html>
    `;
    
    console.log('Launching Puppeteer browser...');
    
    const launchOptions = {
      headless: true,
      timeout: dynamicTimeout,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-plugins',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-default-apps',
        '--window-size=1920,1080'
      ]
    };
    
    // Try multiple Chrome executable paths
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/home/runner/workspace/.cache/puppeteer/chrome/linux-138.0.7204.157/chrome-linux64/chrome',
      '/home/runner/.cache/puppeteer/chrome/linux-138.0.7204.157/chrome-linux64/chrome',
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
    ].filter(Boolean);
    
    let executablePath;
    const fs2 = await import('fs/promises');
    
    // Try to find Chrome executable
    for (const path of possiblePaths) {
      try {
        await fs2.access(path);
        executablePath = path;
        console.log(`Found Chrome at: ${path}`);
        break;
      } catch (error) {
        console.log(`Chrome not found at: ${path}`);
      }
    }
    
    // Try with Nix store glob pattern
    if (!executablePath) {
      try {
        const { execSync } = await import('child_process');
        const nixChrome = execSync('find /nix/store -name chromium -path "*/bin/chromium" 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
        if (nixChrome) {
          await fs2.access(nixChrome);
          executablePath = nixChrome;
          console.log(`Found Chrome via find: ${executablePath}`);
        }
      } catch (error) {
        console.log('Nix store search failed:', error.message);
      }
    }
    
    // Try to use system Chrome/Chromium
    if (!executablePath) {
      try {
        const { execSync } = await import('child_process');
        const systemChrome = execSync('which chromium || which google-chrome || which chrome 2>/dev/null', { encoding: 'utf8' }).trim();
        if (systemChrome) {
          executablePath = systemChrome;
          console.log(`Found system Chrome: ${executablePath}`);
        }
      } catch (error) {
        console.log('System Chrome search failed:', error.message);
      }
    }
    
    if (executablePath) {
      launchOptions.executablePath = executablePath;
      console.log(`Using Chrome executable: ${executablePath}`);
    } else {
      console.log('No Chrome executable found, using default Puppeteer');
    }
    
    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (error) {
      console.error('Failed to launch browser with custom path:', error.message);
      console.error('Attempting fallback approaches...');
      
      // Multiple fallback attempts
      const fallbackAttempts = [
        () => {
          console.log('Trying without executable path...');
          const opts = { ...launchOptions };
          delete opts.executablePath;
          return puppeteer.launch(opts);
        },
        () => {
          console.log('Trying with minimal args...');
          return puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
        },
        () => {
          console.log('Trying with bundled Chromium...');
          return puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
        }
      ];
      
      for (const attempt of fallbackAttempts) {
        try {
          browser = await attempt();
          console.log('Fallback browser launch successful');
          break;
        } catch (fallbackError) {
          console.error('Fallback attempt failed:', fallbackError.message);
        }
      }
      
      if (!browser) {
        throw new Error('All browser launch attempts failed');
      }
    }
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    
    // Set page timeout based on content size
    page.setDefaultTimeout(dynamicTimeout);
    
    console.log('Setting page content for large file...');
    // Set content with dynamic timeout for large files
    await page.setContent(styledHtml, {
      waitUntil: 'domcontentloaded',
      timeout: dynamicTimeout
    });
    
    console.log('Optimizing tables for large content...');
    // Add table classes for dynamic font sizing - limit processing for large files
    await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const maxTables = tables.length > 100 ? 30 : 50; // Limit processing for very large files
      for (let i = 0; i < Math.min(tables.length, maxTables); i++) {
        const table = tables[i];
        const headerRow = table.querySelector('tr');
        if (headerRow) {
          const columnCount = headerRow.children.length;
          if (columnCount < 6) {
            table.classList.add('small-table');
          } else if (columnCount <= 10) {
            table.classList.add('medium-table');
          } else {
            table.classList.add('large-table');
          }
        }
      }
    });
    
    // PDF generation options
    const pdfOptions = {
      format: config.pageSize as any,
      landscape: config.orientation === 'landscape',
      margin: {
        top: '5mm',
        right: '5mm', 
        bottom: '5mm',
        left: '5mm',
      },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: false,
      scale: 0.9
    };
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cohen-report-${jobId}-${timestamp}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    // Generate PDF
    await page.pdf({
      ...pdfOptions,
      path: outputPath,
    });
    
    // Clear timeout and mark job as completed
    completeJob(jobId);
    
    // Update job status to completed
    await storage.updateConversionJobStatus(jobId, "completed", null, outputPath);
    
    return outputPath;
    
  } catch (error) {
    console.error('Puppeteer PDF generation failed:', error);
    console.error('Attempting fallback method...');
    
    try {
      // Try fallback method with html-pdf-node
      console.log('Using html-pdf-node fallback...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `cohen-report-${jobId}-${timestamp}.pdf`;
      const fallbackOutputPath = path.join(PDF_OUTPUT_DIR, filename);
      
      const options = {
        format: config.pageSize,
        orientation: config.orientation,
        margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' },
        printBackground: true,
        preferCSSPageSize: false
      };

      // Enhanced HTML with Cohen styling for fallback
      const fallbackStyledHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: A4 landscape; margin: 5mm; }
            body { font-family: Arial, sans-serif !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
            table { width: 100% !important; border-collapse: collapse !important; margin: 2px 0 !important; font-size: 10px !important; }
            table th, table td { padding: 2px 4px !important; border: 1px solid #ccc !important; vertical-align: top !important; }
            table thead { display: table-header-group !important; background-color: #f5f5f5 !important; }
            .blue-text, .title-blue { color: #0066cc !important; }
            .container { max-width: 100% !important; overflow: hidden !important; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      const file = { content: fallbackStyledHtml };
      const pdfBuffer = await htmlPdf.generatePdf(file, options);
      await fs.writeFile(fallbackOutputPath, pdfBuffer);
      
      // Clear timeout and mark job as completed
      completeJob(jobId);
      
      // Update job status to completed
      await storage.updateConversionJobStatus(jobId, "completed", null, fallbackOutputPath);
      
      console.log('PDF generated successfully with html-pdf-node fallback');
      return fallbackOutputPath;
      
    } catch (fallbackError) {
      console.error('Fallback PDF generation also failed:', fallbackError);
      
      try {
        clearJobTimeout(jobId);
        await storage.updateConversionJobStatus(jobId, "failed", "PDF generation failed - both primary and fallback methods unsuccessful");
      } catch (statusError) {
        console.error('Failed to update job status:', statusError);
      }
      
      const errorMessage = `PDF generation temporarily unavailable. Both primary and fallback methods failed.\n\nSystem error: ${error.message}\n\nFallback error: ${fallbackError.message}`;
      throw new Error(errorMessage);
    }
  } finally {
    try {
      if (browser) {
        console.log('Closing browser...');
        await browser.close();
        console.log('Browser closed successfully');
      }
    } catch (closeError) {
      console.error('Error closing browser:', closeError);
    }
  }
}

function generateCustomCSS(config: PdfConfig): string {
  return `
    @page {
      size: A4 landscape;
      margin: 5mm;
    }
    
    * {
      box-sizing: border-box !important;
    }
    
    body {
      font-family: Arial, sans-serif !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
    }
    
    .container {
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    /* Dynamic font sizing based on column count */
    table.small-table {
      font-size: 12px !important;
    }
    
    table.medium-table {
      font-size: 10px !important;
    }
    
    table.large-table {
      font-size: 8px !important;
    }
    
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 2px 0 !important;
      page-break-inside: auto !important;
    }
    
    table th, table td {
      padding: 2px 4px !important;
      border: 1px solid #ccc !important;
      vertical-align: top !important;
    }
    
    table thead {
      display: table-header-group !important;
      font-weight: bold !important;
    }
    
    table tbody {
      display: table-row-group !important;
    }
    
    .bg-custom-reporte-mensual {
      padding: 8px !important;
      margin: 2px 0 !important;
    }
    
    /* Ensure totals are readable */
    tfoot tr, .total-row {
      font-weight: bold !important;
    }
    
    /* Page break control */
    .card {
      page-break-inside: avoid !important;
    }
    
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid !important;
      margin-top: 5px !important;
      margin-bottom: 5px !important;
    }
  `;
}