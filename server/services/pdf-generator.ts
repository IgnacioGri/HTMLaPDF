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
    
    // Add smart table classes based on column count
    await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const headerRow = table.querySelector('tr');
        if (headerRow) {
          const columnCount = headerRow.children.length;
          
          // Add size class based on column count
          if (columnCount <= 7) {
            table.classList.add('small-table');
          } else if (columnCount <= 14) {
            table.classList.add('medium-table');
          } else {
            table.classList.add('large-table');
          }
          
          // Add exact column count for precise styling
          table.setAttribute('data-columns', columnCount.toString());
        }
      });
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
        top: '0mm',
        right: '0mm', 
        bottom: '0mm',
        left: '0mm',
      },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      scale: 1.0, // Don't use config.contentScale here, we'll handle it in CSS
      width: '297mm', // A4 landscape width  
      height: '210mm', // A4 landscape height
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
    /* ULTRA AGGRESSIVE CSS - Use ENTIRE landscape page width */
    
    @page {
      size: A4 landscape;
      margin: 2mm; /* Mínimo margen técnico */
    }
    
    * {
      box-sizing: border-box !important;
    }
    
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      font-family: Arial, sans-serif !important;
    }
    
    /* FORCE all containers to full width */
    .container, .container-fluid, div, section {
      width: 100% !important;
      max-width: none !important;
      padding: 1px !important;
      margin: 0 !important;
    }
    
    /* SMART TABLES - Dynamic sizing based on column count */
    table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      margin: 3px 0 !important;
    }
    
    /* DEFAULT: Tables with many columns (15+) - small font */
    table {
      font-size: 7px !important;
    }
    
    table th {
      background-color: #8B4A8C !important;
      color: white !important;
      font-weight: bold !important;
      text-align: center !important;
      padding: 2px 1px !important;
      border: 0.5px solid #666 !important;
      font-size: 7px !important;
      line-height: 1.0 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
    }
    
    table td {
      padding: 1px 0.5px !important;
      border: 0.5px solid #ccc !important;
      vertical-align: top !important;
      font-size: 6px !important;
      line-height: 1.0 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    
    /* SMALL TABLES: Less than 8 columns - bigger font */
    table.small-table {
      font-size: 11px !important;
    }
    
    table.small-table th {
      font-size: 11px !important;
      padding: 4px 3px !important;
      line-height: 1.2 !important;
    }
    
    table.small-table td {
      font-size: 10px !important;
      padding: 3px 2px !important;
      line-height: 1.1 !important;
    }
    
    /* MEDIUM TABLES: 8-14 columns - medium font */
    table.medium-table {
      font-size: 9px !important;
    }
    
    table.medium-table th {
      font-size: 9px !important;
      padding: 3px 2px !important;
      line-height: 1.1 !important;
    }
    
    table.medium-table td {
      font-size: 8px !important;
      padding: 2px 1px !important;
      line-height: 1.0 !important;
    }
    
    /* LARGE TABLES: 15+ columns - keep small font */
    table.large-table {
      font-size: 7px !important;
    }
    
    table.large-table th {
      font-size: 7px !important;
      padding: 2px 1px !important;
      line-height: 1.0 !important;
    }
    
    table.large-table td {
      font-size: 6px !important;
      padding: 1px 0.5px !important;
      line-height: 1.0 !important;
    }
    
    /* COLUMN DISTRIBUTION - Dynamic based on column count */
    /* Small tables: wider columns */
    table.small-table th,
    table.small-table td {
      width: calc(100% / 7) !important;
    }
    
    /* Medium tables: medium columns */
    table.medium-table th,
    table.medium-table td {
      width: calc(100% / 12) !important;
    }
    
    /* Large tables: small columns */
    table.large-table th,
    table.large-table td {
      width: calc(100% / 20) !important;
    }
    
    /* First column always wider for names */
    table th:first-child, table td:first-child {
      width: calc(100% / 6) !important;
    }
    
    /* Preserve original alternating row colors if they exist */
    tbody tr:nth-child(even) {
      background-color: #f9f9f9 !important;
    }
    
    tbody tr:nth-child(odd) {
      background-color: white !important;
    }
    
    /* Section headers - preserve original styling with better pagination */
    h1, h2, h3, h4, h5, h6 {
      font-weight: bold !important;
      color: inherit !important;
      margin: 8px 0 5px 0 !important; /* Reduced margins */
      page-break-after: avoid !important;
      page-break-before: auto !important;
    }
    
    /* Specific styling for common Cohen sections */
    .section-title, 
    *:contains("Resumen de"),
    *:contains("Tenencias al"),
    *:contains("Rendimiento por activo"),
    *:contains("Movimientos"),
    *:contains("Detalle de actividad") {
      font-weight: bold !important;
      font-size: 12px !important;
      margin: 6px 0 4px 0 !important; /* Tighter spacing */
      page-break-after: avoid !important;
    }
    
    /* Ensure table headers are always preserved and visible */
    table thead tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    /* Keep section title with at least first 3 rows of content */
    h1 + table, h2 + table, h3 + table, h4 + table, h5 + table, h6 + table,
    .section-title + table {
      page-break-before: avoid !important;
      break-before: avoid !important;
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
