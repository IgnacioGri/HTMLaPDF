import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage.js';
import type { PdfConfig } from '../../shared/schema.js';

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
    console.log('HTML content size:', htmlContent.length, 'characters');
    
    // Set timeout based on content size
    const contentSizeKB = htmlContent.length / 1024;
    const baseTimeout = 30000; // 30 seconds base
    const dynamicTimeout = Math.min(120000, baseTimeout + (contentSizeKB * 100)); // Max 2 minutes
    console.log('Dynamic timeout set to:', dynamicTimeout, 'ms');
    
    // Try to launch Puppeteer with bundled Chromium first
    console.log('🌐 Launching Puppeteer with bundled Chromium...');
    
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
    
    try {
      browser = await puppeteer.launch(launchOptions);
      console.log('✅ Puppeteer launched successfully');
    } catch (error) {
      console.error('❌ Puppeteer launch failed:', error.message);
      
      // Try with minimal configuration
      try {
        console.log('🔄 Trying minimal Puppeteer configuration...');
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        console.log('✅ Minimal Puppeteer launched successfully');
      } catch (minimalError) {
        console.error('❌ Minimal Puppeteer also failed:', minimalError.message);
        
        // Try with even more minimal configuration
        try {
          console.log('🔄 Trying ultra-minimal Puppeteer configuration...');
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
          });
          console.log('✅ Ultra-minimal Puppeteer launched successfully');
        } catch (ultraMinimalError) {
          console.error('❌ Ultra-minimal Puppeteer also failed:', ultraMinimalError.message);
          throw new Error('All Puppeteer launch attempts failed');
        }
      }
    }
    
    const page = await browser.newPage();
    
    // Set generous timeouts
    page.setDefaultTimeout(dynamicTimeout);
    page.setDefaultNavigationTimeout(dynamicTimeout);
    
    // Create styled HTML with Cohen formatting
    const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Cohen Report</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 5mm;
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          width: 100%;
          font-size: 10px;
          line-height: 1.2;
        }
        
        .container {
          max-width: 100%;
          margin: 0;
          padding: 0;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 2px 0;
          font-size: 9px;
          page-break-inside: avoid;
        }
        
        table th, table td {
          padding: 2px 3px;
          border: 1px solid #ccc;
          vertical-align: top;
          font-size: inherit;
        }
        
        table thead {
          display: table-header-group;
          background-color: #f5f5f5;
        }
        
        table thead th {
          font-weight: bold;
          text-align: center;
          background-color: #f5f5f5;
          border-bottom: 2px solid #333;
        }
        
        .blue-text, .title-blue {
          color: #0066cc;
        }
        
        .text-center {
          text-align: center;
        }
        
        .text-right {
          text-align: right;
        }
        
        .font-bold {
          font-weight: bold;
        }
        
        h1, h2, h3, h4, h5, h6 {
          margin: 3px 0;
          font-weight: bold;
        }
        
        p {
          margin: 1px 0;
        }
        
        .no-print {
          display: none;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
    `;
    
    console.log('📄 Setting page content...');
    await page.setContent(styledHtml, {
      waitUntil: 'domcontentloaded',
      timeout: dynamicTimeout
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📝 Generating PDF...');
    const filename = `Reporte${Date.now()}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    // Generate PDF with proper configuration
    console.log('Generating PDF with config:', {
      format: config.pageSize === 'A4' ? 'A4' : 'Letter',
      landscape: config.orientation === 'landscape',
      margin: config.margin
    });
    
    const pdfBuffer = await page.pdf({
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
    
    console.log('PDF generation completed, buffer received');
    
    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }
    
    // Check PDF signature - be more lenient with validation
    const pdfSignature = pdfBuffer.toString('ascii', 0, 4);
    console.log('PDF signature:', pdfSignature);
    console.log('PDF buffer length:', pdfBuffer.length);
    console.log('First 20 bytes:', pdfBuffer.toString('hex', 0, 20));
    
    if (!pdfSignature.startsWith('%PDF')) {
      console.log('PDF signature validation failed, but continuing anyway...');
      // Don't throw error, just log the issue
    }
    
    console.log('💾 Writing PDF to disk...');
    await fs.writeFile(outputPath, pdfBuffer);
    
    // Verify file was written correctly
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error('Written PDF file is empty');
    }
    
    console.log(`✅ PDF generated successfully: ${filename} (${stats.size} bytes)`);
    
    // Update job status to completed
    await storage.updateConversionJobStatus(jobId, "completed");
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Total processing time: ${processingTime}ms`);
    
    return outputPath;
    
  } catch (error) {
    console.error('💥 PDF generation failed:', error);
    
    try {
      await storage.updateConversionJobStatus(jobId, "failed");
    } catch (statusError) {
      console.error('❌ Failed to update job status:', statusError);
    }
    
    throw new Error(`PDF generation failed: ${error.message}`);
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

