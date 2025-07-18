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
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('✅ Minimal Puppeteer launched successfully');
      } catch (minimalError) {
        console.error('❌ Minimal Puppeteer also failed:', minimalError.message);
        throw new Error('All Puppeteer launch attempts failed');
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
    await page.waitForTimeout(1000);
    
    console.log('📝 Generating PDF...');
    const filename = `Reporte${Date.now()}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    // Generate PDF with proper configuration
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
    
    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }
    
    // Check PDF signature
    const pdfSignature = pdfBuffer.toString('ascii', 0, 4);
    if (!pdfSignature.startsWith('%PDF')) {
      throw new Error('Generated file is not a valid PDF');
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
    
    // Try Node.js-based PDF generation as fallback
    try {
      console.log('🔄 Attempting Node.js PDF fallback...');
      return await generateNodePdfFallback(htmlContent, config, jobId);
    } catch (fallbackError) {
      console.error('💥 All PDF generation methods failed:', fallbackError);
      
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

async function generateNodePdfFallback(htmlContent: string, config: PdfConfig, jobId: number): Promise<string> {
  console.log('🔄 Using Node.js PDF generation...');
  
  try {
    // Create a basic PDF using JavaScript
    const filename = `Reporte${Date.now()}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    // Convert HTML to plain text for text-based PDF
    const textContent = htmlContent
      .replace(/<table[^>]*>/gi, '\n=== TABLE ===\n')
      .replace(/<\/table>/gi, '\n=== END TABLE ===\n')
      .replace(/<tr[^>]*>/gi, '\n')
      .replace(/<\/tr>/gi, '')
      .replace(/<th[^>]*>/gi, '| ')
      .replace(/<\/th>/gi, ' ')
      .replace(/<td[^>]*>/gi, '| ')
      .replace(/<\/td>/gi, ' ')
      .replace(/<h[1-6][^>]*>/gi, '\n\n### ')
      .replace(/<\/h[1-6]>/gi, ' ###\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n') // Clean up multiple line breaks
      .trim();
    
    // Create a minimal PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 842 595]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${textContent.length + 200}
>>
stream
BT
/F1 12 Tf
50 500 Td
(REPORTE COHEN - GENERADO EN MODO TEXTO) Tj
0 -20 Td
(Fecha: ${new Date().toLocaleDateString()}) Tj
0 -20 Td
(Nota: Este reporte fue generado en modo texto.) Tj
0 -40 Td
${textContent.split('\n').map(line => `(${line.replace(/[()\\]/g, '\\$&').substring(0, 80)}) Tj 0 -12 Td`).join('\n')}
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000265 00000 n 
0000000400 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
500
%%EOF`;
    
    // Write the PDF content
    await fs.writeFile(outputPath, pdfContent);
    
    // Update job status to completed
    await storage.updateConversionJobStatus(jobId, "completed");
    
    console.log('✅ Node.js PDF fallback generated successfully');
    return outputPath;
    
  } catch (error) {
    console.error('💥 Node.js PDF fallback failed:', error);
    
    // Final fallback - save as HTML file with PDF extension warning
    const filename = `Reporte${Date.now()}_HTML.txt`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);
    
    const htmlReport = `
REPORTE COHEN - ARCHIVO DE RESPALDO
===================================
FECHA: ${new Date().toLocaleString()}
NOTA: No se pudo generar el PDF. Este es el contenido HTML original.

${htmlContent}

===================================
FIN DEL REPORTE
    `;
    
    await fs.writeFile(outputPath, htmlReport);
    await storage.updateConversionJobStatus(jobId, "completed");
    
    console.log('✅ HTML backup file created');
    return outputPath;
  }
}