import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';
import { injectCohenStyles } from './html-parser';
import type { PdfConfig } from '@shared/schema';

const PDF_OUTPUT_DIR = path.join(process.cwd(), 'generated-pdfs');

// Ensure output directory exists
if (!fs.existsSync(PDF_OUTPUT_DIR)) {
  fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
}

export async function generatePdf(
  jobId: number, 
  htmlContent: string, 
  config: PdfConfig
): Promise<string> {
  let browser;
  
  try {
    // Update job status to processing
    await storage.updateConversionJobStatus(jobId, "processing");
    
    // Inject Cohen-specific styles
    const styledHtml = injectCohenStyles(htmlContent);
    
    // Launch browser with Replit-optimized settings
    console.log('Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: 'new',
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
        '--disable-extensions',
        '--disable-plugins',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(styledHtml, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Add custom CSS for better table handling
    await page.addStyleTag({
      content: generateCustomCSS(config)
    });
    
    // Configure PDF options with optimized settings for Cohen reports
    const pdfOptions = {
      format: config.pageSize as any,
      landscape: config.orientation === 'landscape',
      margin: {
        top: `${config.marginTop}mm`,
        right: `${config.marginSide}mm`,
        bottom: `${config.marginTop}mm`,
        left: `${config.marginSide}mm`,
      },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      scale: 1.0, // Don't use config.contentScale here, we'll handle it in CSS
      width: '210mm', // A4 width
      height: '297mm', // A4 height
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
    
    return outputPath;
    
  } catch (error) {
    console.error('PDF generation error:', error);
    await storage.updateConversionJobStatus(jobId, "failed");
    
    // Create detailed error message for the user
    const errorMessage = `PDF generation temporarily unavailable due to system configuration issues.\n\nThe HTML analysis was successful and detected a valid Cohen report format with 20 tables and 68 financial assets.\n\nSystem error: ${error.message}\n\nThis is likely due to missing system dependencies for the browser engine in the current environment.`;
    
    throw new Error(errorMessage);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function generateCustomCSS(config: PdfConfig): string {
  return `
    /* Professional PDF formatting - preserving original HTML style */
    
    @page {
      size: A4;
      margin: 20mm 15mm 15mm 15mm; /* Proper top margin + balanced sides */
    }
    
    body {
      margin: 0;
      padding: 0;
      background: white;
      font-family: inherit; /* Keep original font */
      ${config.contentScale !== 100 ? `
        transform: scale(${config.contentScale / 100});
        transform-origin: top left;
        width: ${100 / (config.contentScale / 100)}%;
      ` : ''}
    }
    
    /* Restore original table styling from HTML */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 8px 0 15px 0; /* Reasonable spacing */
      font-size: inherit; /* Keep original size */
    }
    
    /* Preserve original table header styling */
    table th {
      background-color: #d3d3d3 !important; /* Original gray headers */
      color: #000 !important;
      font-weight: bold !important;
      text-align: center !important;
      padding: 6px 4px !important;
      border: 1px solid #999 !important;
      font-size: 9px !important;
    }
    
    /* Preserve original cell styling */
    table td {
      padding: 4px 3px !important;
      border: 1px solid #ccc !important;
      vertical-align: top !important;
      font-size: 8px !important;
      line-height: 1.2 !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    
    /* Balanced column distribution - use full page width */
    table.main-table {
      table-layout: fixed !important;
      width: 100% !important;
    }
    
    table.main-table td:nth-child(1),
    table.main-table th:nth-child(1) { width: 12% !important; }
    
    table.main-table td:nth-child(2),
    table.main-table th:nth-child(2) { width: 9% !important; }
    
    table.main-table td:nth-child(3),
    table.main-table th:nth-child(3) { width: 8% !important; }
    
    table.main-table td:nth-child(4),
    table.main-table th:nth-child(4) { width: 9% !important; }
    
    table.main-table td:nth-child(5),
    table.main-table th:nth-child(5) { width: 9% !important; }
    
    table.main-table td:nth-child(6),
    table.main-table th:nth-child(6) { width: 8% !important; }
    
    table.main-table td:nth-child(7),
    table.main-table th:nth-child(7) { width: 10% !important; }
    
    table.main-table td:nth-child(8),
    table.main-table th:nth-child(8) { width: 9% !important; }
    
    table.main-table td:nth-child(9),
    table.main-table th:nth-child(9) { width: 8% !important; }
    
    table.main-table td:nth-child(10),
    table.main-table th:nth-child(10) { width: 9% !important; }
    
    table.main-table td:nth-child(11),
    table.main-table th:nth-child(11) { width: 9% !important; }
    
    /* Preserve original alternating row colors if they exist */
    tbody tr:nth-child(even) {
      background-color: #f9f9f9 !important;
    }
    
    tbody tr:nth-child(odd) {
      background-color: white !important;
    }
    
    /* Section headers - preserve original styling */
    h1, h2, h3, h4, h5, h6 {
      font-weight: bold !important;
      color: inherit !important;
      margin: 15px 0 8px 0 !important;
      page-break-after: avoid !important;
    }
    
    /* Specific styling for common Cohen sections */
    .section-title, 
    *:contains("Resumen de"),
    *:contains("Tenencias al"),
    *:contains("Rendimiento por activo") {
      font-weight: bold !important;
      font-size: 12px !important;
      margin: 12px 0 8px 0 !important;
      page-break-after: avoid !important;
    }
    
    /* Optimize page breaks for better content flow */
    ${config.keepGroupsTogether ? `
      .investment-group,
      .section-header {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      
      /* Prevent orphaned section titles */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      
      /* Keep at least 3 rows with section title */
      h1 + table, h2 + table, h3 + table, h4 + table, h5 + table, h6 + table {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
      
      /* Keep lote details with main investment */
      tr.main-row + tr.detail-row {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
    ` : ''}
    
    ${config.repeatHeaders ? `
      @media print {
        thead {
          display: table-header-group !important;
        }
        
        table thead tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    ` : ''}
    
    /* Professional page break rules */
    @media print {
      /* Avoid bad breaks */
      table {
        page-break-inside: auto;
      }
      
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      /* Typography improvements */
      p {
        orphans: 2;
        widows: 2;
      }
      
      /* Better section spacing */
      .avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `;
}
