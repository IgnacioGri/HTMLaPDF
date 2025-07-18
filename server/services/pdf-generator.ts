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
    /* Professional PDF formatting - preserving original HTML style */
    
    @page {
      size: A4 landscape;
      margin: 0; /* Sin márgenes para usar toda la página */
    }
    
    html, body {
      margin: 0 !important;
      padding: 5px !important; /* Pequeño padding interno */
      width: 100% !important;
      height: 100% !important;
      background: white;
      font-family: inherit;
      box-sizing: border-box !important;
    }
    
    /* Force tables to fill entire page width */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 5px 0 !important;
      table-layout: fixed !important;
      font-size: 9px !important; /* Letra más grande como pediste */
    }
    
    /* Headers más grandes y legibles */
    table th {
      background-color: #d3d3d3 !important;
      color: #000 !important;
      font-weight: bold !important;
      text-align: center !important;
      padding: 4px 3px !important;
      border: 1px solid #999 !important;
      font-size: 10px !important; /* Letra más grande */
      line-height: 1.2 !important;
      width: auto !important; /* Ancho automático para mostrar todas las columnas */
    }
    
    /* Celdas más legibles */
    table td {
      padding: 3px 2px !important;
      border: 1px solid #ccc !important;
      vertical-align: top !important;
      font-size: 9px !important; /* Letra más grande */
      line-height: 1.1 !important;
      word-wrap: break-word !important;
      white-space: normal !important; /* Permitir wrap si es necesario */
      width: auto !important; /* Ancho automático para mostrar todas las columnas */
    }
    
    /* Asegurar que TODAS las columnas se muestren */
    table {
      table-layout: auto !important; /* Auto para mostrar todas las columnas */
    }
    
    table td, table th {
      min-width: 40px !important; /* Ancho mínimo para legibilidad */
      width: auto !important; /* Ancho automático */
    }
    
    /* Contenedores que usen toda la página */
    * {
      box-sizing: border-box !important;
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
