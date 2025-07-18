import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage.js';
import type { PdfConfig } from '../../shared/schema.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const PDF_OUTPUT_DIR = './generated-pdfs';

export async function generatePdf(htmlContent: string, config: PdfConfig, jobId: number): Promise<string> {
  let browser = null;
  const startTime = Date.now();
  
  try {
    // Ensure output directory exists
    await fs.mkdir(PDF_OUTPUT_DIR, { recursive: true });
    
    // Update job status to processing
    await storage.updateConversionJobStatus(jobId, "processing");
    
    console.log('🔄 Starting PDF generation...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('HTML content size:', htmlContent.length, 'characters');
    
    // Set timeout based on content size - larger files need more time
    const contentSizeKB = htmlContent.length / 1024;
    const baseTimeout = 30000; // 30 seconds base
    const dynamicTimeout = Math.min(120000, baseTimeout + (contentSizeKB * 100)); // Max 2 minutes
    console.log('Dynamic timeout set to:', dynamicTimeout, 'ms for', Math.round(contentSizeKB), 'KB content');
    
    // Optimize HTML for large files
    let optimizedHtml = htmlContent;
    if (contentSizeKB > 500) { // If file is larger than 500KB
      console.log('⚡ Optimizing large HTML content...');
      optimizedHtml = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/style="[^"]*"/gi, '') // Remove inline styles that conflict
        .replace(/class="ql-[^"]*"/gi, 'class=""') // Simplify Quill editor classes
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      console.log('✅ HTML optimized from', Math.round(contentSizeKB), 'KB to', Math.round(optimizedHtml.length / 1024), 'KB');
    }

    // Enhanced Chrome executable path detection for production
    const possibleChromePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/opt/google/chrome/chrome',
      '/home/runner/workspace/.cache/puppeteer/chrome/linux-138.0.7204.157/chrome-linux64/chrome',
      '/home/runner/.cache/puppeteer/chrome/linux-138.0.7204.157/chrome-linux64/chrome'
    ].filter(Boolean);
    
    let executablePath = null;
    console.log('🔍 Searching for Chrome executable...');
    
    // Try each possible path
    for (const chromePath of possibleChromePaths) {
      try {
        await fs.access(chromePath);
        executablePath = chromePath;
        console.log('✅ Found Chrome at:', chromePath);
        break;
      } catch (error) {
        console.log('❌ Chrome not found at:', chromePath);
      }
    }
    
    // Try Nix store search as fallback
    if (!executablePath) {
      try {
        const { execSync } = await import('child_process');
        const nixChrome = execSync('find /nix/store -name chromium -path "*/bin/chromium" 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
        if (nixChrome) {
          await fs.access(nixChrome);
          executablePath = nixChrome;
          console.log('✅ Found Chrome via Nix store:', executablePath);
        }
      } catch (error) {
        console.log('❌ Nix store search failed:', error.message);
      }
    }
    
    // Try system PATH search
    if (!executablePath) {
      try {
        const { execSync } = await import('child_process');
        const systemChrome = execSync('which chromium || which google-chrome || which chrome 2>/dev/null', { encoding: 'utf8' }).trim();
        if (systemChrome) {
          executablePath = systemChrome;
          console.log('✅ Found system Chrome:', executablePath);
        }
      } catch (error) {
        console.log('❌ System Chrome search failed:', error.message);
      }
    }
    
    if (!executablePath) {
      console.warn('⚠️ No Chrome executable found, using Puppeteer default');
    } else {
      console.log('🚀 Using Chrome executable:', executablePath);
    }
    
    // Production-ready launch options
    const launchOptions: any = {
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
        '--window-size=1920,1080',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-extensions',
        '--disable-plugins-discovery',
        '--disable-preconnect',
        '--disable-prefetch'
      ]
    };
    
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    
    // Launch browser with multiple fallback attempts
    console.log('🌐 Launching Puppeteer browser...');
    
    const fallbackAttempts = [
      () => puppeteer.launch(launchOptions),
      () => {
        console.log('🔄 Trying without executable path...');
        const opts = { ...launchOptions };
        delete opts.executablePath;
        return puppeteer.launch(opts);
      },
      () => {
        console.log('🔄 Trying with minimal args...');
        return puppeteer.launch({
          headless: true,
          timeout: dynamicTimeout,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
      },
      () => {
        console.log('🔄 Trying with bundled Chromium...');
        return puppeteer.launch({
          headless: true,
          timeout: dynamicTimeout,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
    ];
    
    for (const attempt of fallbackAttempts) {
      try {
        browser = await attempt();
        console.log('✅ Browser launched successfully');
        break;
      } catch (error) {
        console.error('❌ Browser launch attempt failed:', error.message);
      }
    }
    
    if (!browser) {
      console.error('💥 All browser launch attempts failed - using fallback PDF generation');
      return await generatePdfFallback(htmlContent, config, jobId);
    }
    
    // Set up browser error handling
    browser.on('disconnected', () => {
      console.warn('⚠️ Browser disconnected unexpectedly');
    });
    
    const page = await browser.newPage();
    
    // Set up page error handling
    page.on('error', (error) => {
      console.error('❌ Page error:', error);
    });
    
    page.on('pageerror', (error) => {
      console.error('❌ Page script error:', error);
    });
    
    // Set generous timeouts for large files
    page.setDefaultTimeout(dynamicTimeout);
    page.setDefaultNavigationTimeout(dynamicTimeout);
    
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
    
    console.log('📄 Setting page content for large file...');
    await page.setContent(styledHtml, {
      waitUntil: 'domcontentloaded',
      timeout: dynamicTimeout
    });
    
    // Add table optimization for large content
    if (contentSizeKB > 200) {
      console.log('🔧 Optimizing tables for large content...');
      await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const rows = table.querySelectorAll('tr').length;
          if (rows > 50) {
            table.style.fontSize = '8px';
            table.style.lineHeight = '1.2';
          } else if (rows > 20) {
            table.style.fontSize = '9px';
            table.style.lineHeight = '1.3';
          }
        });
      });
    }
    
    // Wait for any remaining content to load
    await page.waitForTimeout(1000);
    
    console.log('📝 Generating PDF...');
    const filename = `Reporte${Date.now()}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    // PDF generation with optimized settings
    await page.pdf({
      path: outputPath,
      format: config.pageSize === 'A4' ? 'A4' : 'Letter',
      landscape: config.orientation === 'landscape',
      margin: {
        top: config.margin?.top || '5mm',
        right: config.margin?.right || '5mm',
        bottom: config.margin?.bottom || '5mm',
        left: config.margin?.left || '5mm'
      },
      printBackground: true,
      preferCSSPageSize: false,
      timeout: dynamicTimeout
    });
    
    // Update job status to completed
    await storage.updateConversionJobStatus(jobId, "completed");
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ PDF generated successfully in ${processingTime}ms: ${filename}`);
    
    return outputPath;
    
  } catch (error) {
    console.error('💥 Puppeteer PDF generation failed:', error);
    console.log('🔄 Attempting fallback method...');
    
    try {
      return await generatePdfFallback(htmlContent, config, jobId);
    } catch (fallbackError) {
      console.error('💥 Fallback PDF generation also failed:', fallbackError);
      
      try {
        await storage.updateConversionJobStatus(jobId, "failed");
      } catch (statusError) {
        console.error('❌ Failed to update job status:', statusError);
      }
      
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  } finally {
    try {
      if (browser) {
        console.log('🔄 Closing browser...');
        await browser.close();
        console.log('✅ Browser closed successfully');
      }
    } catch (closeError) {
      console.error('❌ Error closing browser:', closeError);
    }
  }
}

async function generatePdfFallback(htmlContent: string, config: PdfConfig, jobId: number): Promise<string> {
  console.log('🔄 Using html-pdf-node fallback...');
  
  try {
    const htmlPdf = require('html-pdf-node');
    
    const filename = `Reporte${Date.now()}.pdf`;
    const fallbackOutputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    const options = {
      format: config.pageSize === 'A4' ? 'A4' : 'Letter',
      landscape: config.orientation === 'landscape',
      margin: {
        top: config.margin?.top || '5mm',
        right: config.margin?.right || '5mm',
        bottom: config.margin?.bottom || '5mm',
        left: config.margin?.left || '5mm'
      },
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
    
    // Update job status to completed
    await storage.updateConversionJobStatus(jobId, "completed");
    
    console.log('✅ PDF generated successfully with html-pdf-node fallback');
    return fallbackOutputPath;
    
  } catch (error) {
    console.error('💥 html-pdf-node fallback failed:', error);
    return await generateSimplePdfFallback(htmlContent, config, jobId);
  }
}

async function generateSimplePdfFallback(htmlContent: string, config: PdfConfig, jobId: number): Promise<string> {
  console.log('🔄 Using simple PDF fallback...');
  
  try {
    const filename = `Reporte${Date.now()}.pdf`;
    const simpleOutputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    // Create a simple HTML file with print-friendly styles
    const simplePdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @media print {
            @page { size: A4 landscape; margin: 5mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; width: 100%; }
            table { width: 100%; border-collapse: collapse; margin: 2px 0; font-size: 10px; }
            table th, table td { padding: 2px 4px; border: 1px solid #ccc; vertical-align: top; }
            table thead { display: table-header-group; background-color: #f5f5f5; }
            .blue-text, .title-blue { color: #0066cc; }
            .container { max-width: 100%; overflow: hidden; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    // Save as HTML file (user can print to PDF)
    await fs.writeFile(simpleOutputPath.replace('.pdf', '.html'), simplePdfHtml);
    
    // Update job status to completed
    await storage.updateConversionJobStatus(jobId, "completed");
    
    console.log('✅ Simple PDF fallback generated');
    return simpleOutputPath.replace('.pdf', '.html');
    
  } catch (error) {
    console.error('💥 Simple PDF fallback failed:', error);
    
    try {
      await storage.updateConversionJobStatus(jobId, "failed");
    } catch (statusError) {
      console.error('❌ Failed to update job status:', statusError);
    }
    
    throw new Error(`All PDF generation methods failed: ${error.message}`);
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
      font-size: 10px !important;
      page-break-inside: avoid !important;
    }
    
    table th, table td {
      padding: 2px 4px !important;
      border: 1px solid #ccc !important;
      vertical-align: top !important;
      font-size: inherit !important;
    }
    
    table thead {
      display: table-header-group !important;
      background-color: #f5f5f5 !important;
    }
    
    table thead th {
      font-weight: bold !important;
      text-align: center !important;
      background-color: #f5f5f5 !important;
      border-bottom: 2px solid #333 !important;
    }
    
    .blue-text, .title-blue {
      color: #0066cc !important;
    }
    
    .text-center {
      text-align: center !important;
    }
    
    .text-right {
      text-align: right !important;
    }
    
    .font-bold {
      font-weight: bold !important;
    }
    
    /* Prevent page breaks within content sections */
    section {
      page-break-inside: avoid !important;
    }
    
    /* Allow page breaks only between major sections */
    .page-break {
      page-break-before: always !important;
    }
    
    /* Ensure proper spacing */
    h1, h2, h3, h4, h5, h6 {
      margin: 5px 0 !important;
      font-weight: bold !important;
    }
    
    p {
      margin: 2px 0 !important;
    }
    
    /* Hide elements that shouldn't be printed */
    .no-print {
      display: none !important;
    }
    
    /* Cohen-specific styling */
    .cohen-header {
      background-color: #f8f9fa !important;
      padding: 10px !important;
      border-bottom: 2px solid #dee2e6 !important;
    }
    
    .cohen-footer {
      background-color: #f8f9fa !important;
      padding: 5px !important;
      border-top: 1px solid #dee2e6 !important;
      font-size: 8px !important;
    }
  `;
}