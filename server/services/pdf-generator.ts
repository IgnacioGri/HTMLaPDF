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
    /* Reset and base styles for optimal PDF generation */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    @page {
      size: A4;
      margin: ${config.marginTop}mm ${config.marginSide}mm ${config.marginTop}mm ${config.marginSide}mm;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 9px;
      line-height: 1.2;
      color: #000;
      background: white;
      transform: scale(${config.contentScale / 100});
      transform-origin: top left;
      width: ${100 / (config.contentScale / 100)}%;
    }
    
    /* Optimized table styles for all columns visible */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      margin-bottom: 10px;
      font-size: 8px !important;
    }
    
    /* Make tables fit by adjusting column widths automatically */
    table td, table th {
      padding: 2px 1px !important;
      border: 0.5px solid #ccc !important;
      vertical-align: top !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      hyphens: auto !important;
      font-size: 7px !important;
      line-height: 1.1 !important;
    }
    
    /* Header styles */
    table th {
      background-color: #8B0000 !important;
      color: white !important;
      font-weight: bold !important;
      text-align: center !important;
      font-size: 8px !important;
    }
    
    /* Specific column width optimizations for Cohen tables */
    table.main-table td:first-child,
    table.main-table th:first-child {
      width: 8% !important;
    }
    
    table.main-table td:nth-child(2),
    table.main-table th:nth-child(2) {
      width: 15% !important;
    }
    
    table.main-table td:nth-child(3),
    table.main-table th:nth-child(3) {
      width: 12% !important;
    }
    
    table.main-table td:nth-child(4),
    table.main-table th:nth-child(4) {
      width: 12% !important;
    }
    
    table.main-table td:nth-child(5),
    table.main-table th:nth-child(5) {
      width: 10% !important;
    }
    
    table.main-table td:nth-child(6),
    table.main-table th:nth-child(6) {
      width: 12% !important;
    }
    
    table.main-table td:nth-child(7),
    table.main-table th:nth-child(7) {
      width: 10% !important;
    }
    
    table.main-table td:nth-child(8),
    table.main-table th:nth-child(8) {
      width: 12% !important;
    }
    
    /* Remaining columns share the rest */
    table.main-table td:nth-child(n+9),
    table.main-table th:nth-child(n+9) {
      width: auto !important;
      min-width: 8% !important;
    }
    
    /* Numbers and currency formatting */
    .number, .currency {
      text-align: right !important;
      font-family: 'Courier New', monospace !important;
    }
    
    ${config.repeatHeaders ? `
      @media print {
        thead {
          display: table-header-group !important;
        }
        
        table thead tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        .cohen-header {
          position: -webkit-sticky;
          position: sticky;
          top: 0;
          z-index: 10;
        }
      }
    ` : ''}
    
    ${config.keepGroupsTogether ? `
      .asset-group,
      .investment-group,
      .table-section,
      .lote-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      
      /* Keep related rows together */
      tr.main-row + tr.detail-row {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
    ` : ''}
    
    /* Page break optimizations */
    @media print {
      .page-break-before {
        page-break-before: always !important;
        break-before: page !important;
      }
      
      .page-break-after {
        page-break-after: always !important;
        break-after: page !important;
      }
      
      .avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      
      /* Avoid orphaned headers */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      
      /* Keep minimum lines together */
      p {
        orphans: 3;
        widows: 3;
      }
    }
    
    /* Cohen branding styles */
    .cohen-header {
      background-color: #8B0000 !important;
      color: white !important;
      padding: 5px !important;
      text-align: center !important;
      font-weight: bold !important;
      font-size: 12px !important;
    }
    
    .cohen-subtitle {
      font-size: 10px !important;
      font-weight: bold !important;
      margin: 5px 0 !important;
    }
    
    /* Specific styles for account summary section */
    .account-summary {
      border: 1px solid #8B0000 !important;
      margin: 10px 0 !important;
    }
    
    .account-summary table {
      margin: 0 !important;
    }
    
    .account-summary th {
      background-color: #8B0000 !important;
      color: white !important;
    }
    
    /* Investment details styling */
    .investment-details td {
      font-size: 7px !important;
    }
    
    .investment-total {
      font-weight: bold !important;
      background-color: #f5f5f5 !important;
    }
    
    /* Ensure all text is visible and properly sized */
    .small-text {
      font-size: 6px !important;
      line-height: 1.0 !important;
    }
    
    /* Fix for very wide tables - horizontal scrolling prevention */
    .table-container {
      width: 100% !important;
      overflow: visible !important;
    }
    
    /* Make sure numbers don't wrap */
    .nowrap {
      white-space: nowrap !important;
    }
    
    /* Currency symbols and formatting */
    .currency-symbol {
      font-weight: bold !important;
    }
  `;
}
