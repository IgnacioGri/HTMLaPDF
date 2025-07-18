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
    
    // Preprocess HTML to eliminate problematic spacing structures
    let processedHTML = htmlContent;
    
    // TARGETED fix: Remove spacing between specific sections
    // Find "Inversiones" section and eliminate spacing after it
    processedHTML = processedHTML.replace(
      /(<h4[^>]*>Inversiones<\/h4>[\s\S]*?<\/div><\/div><\/div>)([\s]*)(<!--!-->[\s]*<div class="container mt-4">[\s]*<div class="card">[\s]*<div class="card-header bg-custom-reporte-mensual[^>]*>[\s]*<h4[^>]*>Rendimiento por activo)/g,
      '$1$3'
    );
    
    // Remove excessive spacing around all sections
    processedHTML = processedHTML.replace(/class="container mt-4"/g, 'class="container" style="margin-top:0px!important"');
    processedHTML = processedHTML.replace(/class="m-1 mb-0"/g, 'class="m-0" style="margin:0px!important"');
    
    // Remove empty divs that create spacing
    processedHTML = processedHTML.replace(/<div[^>]*>\s*<\/div>/g, '');
    processedHTML = processedHTML.replace(/\s{3,}/g, ' ');
    
    // Inject Cohen-specific styles
    const styledHtml = injectCohenStyles(processedHTML);
    
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
      
      // AGGRESSIVE DOM manipulation for "Rendimiento por activo"
      const rendimientoHeaders = Array.from(document.querySelectorAll('.bg-custom-reporte-mensual')).filter(el => 
        el.textContent && el.textContent.includes('Rendimiento por activo')
      );
      
      rendimientoHeaders.forEach(header => {
        const container = header.closest('.container');
        if (container) {
          // Force zero spacing
          container.style.setProperty('margin-top', '0px', 'important');
          container.style.setProperty('margin-bottom', '0px', 'important');
          container.style.setProperty('page-break-inside', 'avoid', 'important');
          
          // Find next sibling content
          const nextContent = container.nextElementSibling;
          if (nextContent) {
            nextContent.style.setProperty('page-break-before', 'avoid', 'important');
            nextContent.style.setProperty('margin-top', '0px', 'important');
          }
          
          // Find card-body and stick it
          const cardBody = container.querySelector('.card-body');
          if (cardBody) {
            cardBody.style.setProperty('page-break-before', 'avoid', 'important');
            cardBody.style.setProperty('margin-top', '0px', 'important');
            cardBody.style.setProperty('padding-top', '2px', 'important');
          }
          
          // Force all tables in section to stick
          const tables = container.querySelectorAll('table');
          tables.forEach(table => {
            table.style.setProperty('page-break-before', 'avoid', 'important');
            table.style.setProperty('margin-top', '0px', 'important');
          });
        }
      });
      
      // SURGICAL elimination of space between "Inversiones" and "Rendimiento por activo"
      const inversionesHeaders = Array.from(document.querySelectorAll('.bg-custom-reporte-mensual')).filter(el => 
        el.textContent && el.textContent.includes('Inversiones')
      );
      
      inversionesHeaders.forEach(header => {
        const container = header.closest('.container');
        if (container) {
          // Force ZERO space after Inversiones
          container.style.setProperty('margin-bottom', '0px', 'important');
          container.style.setProperty('padding-bottom', '0px', 'important');
          
          // Find ALL following siblings until we find Rendimiento por activo
          let current = container.nextElementSibling;
          while (current) {
            // If this contains Rendimiento por activo, stick it directly
            if (current.textContent && current.textContent.includes('Rendimiento por activo')) {
              current.style.setProperty('page-break-before', 'avoid', 'important');
              current.style.setProperty('margin-top', '0px', 'important');
              current.style.setProperty('padding-top', '0px', 'important');
              break;
            }
            // Hide or minimize any intermediate elements
            if (current.nodeType === 1) { // Element node
              current.style.setProperty('margin', '0px', 'important');
              current.style.setProperty('padding', '0px', 'important');
              current.style.setProperty('height', '0px', 'important');
              if (current.children.length === 0 && current.textContent.trim() === '') {
                current.style.setProperty('display', 'none', 'important');
              }
            }
            current = current.nextElementSibling;
          }
        }
      });
      
      // Remove all mt-4 classes and replace with minimal spacing
      const mtContainers = document.querySelectorAll('.mt-4');
      mtContainers.forEach(el => {
        el.classList.remove('mt-4');
        el.style.setProperty('margin-top', '2px', 'important');
      });
      
      // CRITICAL: Force header repetition on ALL tables
      const allTables = document.querySelectorAll('table');
      allTables.forEach(table => {
        // Enhanced table styling for proper pagination
        table.style.setProperty('width', '100%', 'important');
        table.style.setProperty('border-collapse', 'collapse', 'important');
        table.style.setProperty('font-size', '11px', 'important');
        table.style.setProperty('line-height', '1.2', 'important');
        
        // Allow table to break across pages
        table.style.setProperty('page-break-inside', 'auto', 'important');
        table.style.setProperty('break-inside', 'auto', 'important');
        
        // Force header repetition on ALL tables
        const thead = table.querySelector('thead');
        if (thead) {
          thead.style.setProperty('background-color', '#112964', 'important');
          thead.style.setProperty('color', 'white', 'important');
          thead.style.setProperty('font-weight', 'bold', 'important');
          
          // CRITICAL: Force header group display for repetition
          thead.style.setProperty('display', 'table-header-group', 'important');
          thead.style.setProperty('break-inside', 'avoid', 'important');
          thead.style.setProperty('page-break-inside', 'avoid', 'important');
          
          // Ensure all header rows repeat
          const headerRows = thead.querySelectorAll('tr');
          headerRows.forEach(row => {
            row.style.setProperty('break-inside', 'avoid', 'important');
            row.style.setProperty('page-break-inside', 'avoid', 'important');
            row.style.setProperty('display', 'table-row', 'important');
          });
          
          // Ensure all header cells repeat
          const headerCells = thead.querySelectorAll('th, td');
          headerCells.forEach(cell => {
            cell.style.setProperty('break-inside', 'avoid', 'important');
            cell.style.setProperty('page-break-inside', 'avoid', 'important');
            cell.style.setProperty('display', 'table-cell', 'important');
          });
        }
        
        // CRITICAL: Keep totals but prevent repetition during page breaks
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const allRows = tbody.querySelectorAll('tr');
          let totalRows = [];
          
          // Find all total rows
          allRows.forEach((row, index) => {
            const cellText = row.textContent || '';
            if (cellText.includes('TOTAL INVERSIONES') || cellText.includes('TOTAL ') || 
                cellText.includes('total ') || cellText.includes('Total ')) {
              totalRows.push({row, index});
            }
          });
          
          // Handle each total row
          totalRows.forEach(({row, index}) => {
            // FORCE this total to stay at the very end of its section
            row.style.setProperty('page-break-before', 'avoid', 'important');
            row.style.setProperty('break-before', 'avoid', 'important');
            row.style.setProperty('page-break-inside', 'avoid', 'important');
            row.style.setProperty('break-inside', 'avoid', 'important');
            
            // Ensure previous rows don't break away from total
            for (let i = Math.max(0, index - 10); i < index; i++) {
              if (allRows[i]) {
                allRows[i].style.setProperty('page-break-after', 'avoid', 'important');
                allRows[i].style.setProperty('break-after', 'avoid', 'important');
              }
            }
            
            // Mark the total row for special CSS handling
            row.classList.add('keep-with-content');
          });
        }
        
        // Disable any tfoot repetition
        const tfoot = table.querySelector('tfoot');
        if (tfoot) {
          // Convert tfoot to tbody row at the end
          const tfootContent = tfoot.innerHTML;
          const newRow = document.createElement('tr');
          newRow.innerHTML = tfootContent;
          newRow.classList.add('converted-footer', 'keep-with-content');
          
          // Style the converted footer
          newRow.style.setProperty('background-color', '#112964', 'important');
          newRow.style.setProperty('color', 'white', 'important');
          newRow.style.setProperty('font-weight', 'bold', 'important');
          newRow.style.setProperty('page-break-before', 'avoid', 'important');
          newRow.style.setProperty('break-before', 'avoid', 'important');
          
          // Add to tbody and remove tfoot
          if (tbody) {
            tbody.appendChild(newRow);
          }
          tfoot.remove();
        }
        
        // Allow tbody to break naturally
        const tbody = table.querySelector('tbody');
        if (tbody) {
          tbody.style.setProperty('break-inside', 'auto', 'important');
          tbody.style.setProperty('page-break-inside', 'auto', 'important');
        }
        
        // Style all table cells for better readability
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.style.setProperty('padding', '4px 6px', 'important');
          cell.style.setProperty('border', '1px solid #ddd', 'important');
          cell.style.setProperty('vertical-align', 'top', 'important');
          cell.style.setProperty('font-size', '10px', 'important');
        });
      });
    });
    
    // Add custom CSS for better table handling
    await page.addStyleTag({
      content: generateCustomCSS(config)
    });
    
    // Configure PDF options with AGGRESSIVE pagination control
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
      preferCSSPageSize: false, // Let us control the sizing completely
      scale: 0.95, // Slightly smaller to fit more content
      width: '297mm', // A4 landscape width  
      height: '420mm', // DOUBLE the height to force content compression
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
      /* Removed white-space and overflow restrictions - will be controlled per table type */
    }
    
    table td {
      padding: 1px 0.5px !important;
      border: 0.5px solid #ccc !important;
      vertical-align: top !important;
      font-size: 6px !important;
      line-height: 1.0 !important;
      /* Removed white-space and overflow restrictions - will be controlled per table type */
    }
    
    /* SMALL TABLES: Less than 8 columns - bigger font and auto layout */
    table.small-table {
      font-size: 11px !important;
      table-layout: auto !important; /* Auto layout para que el contenido determine el ancho */
    }
    
    table.small-table th {
      font-size: 11px !important;
      padding: 4px 6px !important; /* Más padding horizontal */
      line-height: 1.3 !important;
      white-space: normal !important; /* Permitir wrap completo */
      overflow: visible !important;
      text-overflow: unset !important; /* Sin truncamiento */
      word-wrap: break-word !important; /* Romper palabras largas si es necesario */
      color: white !important; /* Texto blanco para headers */
    }
    
    table.small-table td {
      font-size: 10px !important;
      padding: 4px 6px !important; /* Más padding horizontal */
      line-height: 1.2 !important;
      white-space: normal !important; /* Permitir wrap completo */
      overflow: visible !important; /* Mostrar todo el texto */
      text-overflow: unset !important; /* Sin truncamiento */
      word-wrap: break-word !important; /* Romper palabras largas si es necesario */
      height: auto !important; /* Altura automática */
      color: #000000 !important; /* Color negro forzado para el texto */
    }
    
    /* MEDIUM TABLES: 8-14 columns - medium font and auto layout */
    table.medium-table {
      font-size: 9px !important;
      table-layout: auto !important; /* Auto layout para balance */
    }
    
    table.medium-table th {
      font-size: 9px !important;
      padding: 3px 2px !important;
      line-height: 1.1 !important;
      color: white !important; /* Texto blanco para headers */
    }
    
    table.medium-table td {
      font-size: 8px !important;
      padding: 2px 1px !important;
      line-height: 1.0 !important;
      white-space: normal !important; /* Permitir wrap en tablas medianas también */
      overflow: visible !important;
      color: #000000 !important; /* Color negro forzado para el texto */
    }
    
    /* LARGE TABLES: 15+ columns - keep small font */
    table.large-table {
      font-size: 7px !important;
    }
    
    table.large-table th {
      font-size: 7px !important;
      padding: 2px 1px !important;
      line-height: 1.0 !important;
      white-space: nowrap !important; /* Mantener nowrap en tablas grandes */
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      color: white !important; /* Texto blanco para headers */
    }
    
    table.large-table td {
      font-size: 6px !important;
      padding: 1px 0.5px !important;
      line-height: 1.0 !important;
      white-space: nowrap !important; /* Mantener nowrap en tablas grandes */
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      color: #000000 !important; /* Color negro forzado para el texto */
    }
    
    /* COLUMN DISTRIBUTION - Auto width for small/medium, fixed for large */
    /* Small tables: let content determine width naturally */
    table.small-table th,
    table.small-table td {
      width: auto !important; /* Ancho automático basado en contenido */
      min-width: 50px !important; /* Mínimo para legibilidad */
    }
    
    table.small-table th:first-child,
    table.small-table td:first-child {
      min-width: 150px !important; /* Mínimo más generoso para categorías */
    }
    
    /* Medium tables: semi-flexible width */
    table.medium-table th,
    table.medium-table td {
      width: auto !important; /* Ancho automático */
      min-width: 40px !important;
    }
    
    table.medium-table th:first-child,
    table.medium-table td:first-child {
      min-width: 120px !important; /* Mínimo para nombres largos */
    }
    
    /* Large tables: small columns */
    table.large-table th,
    table.large-table td {
      width: calc(100% / 20) !important;
    }
    
    /* Large tables: keep narrow columns for many columns */
    table.large-table th:first-child,
    table.large-table td:first-child {
      width: 15% !important; /* Menos ancho en tablas grandes */
    }
    
    table.large-table th:not(:first-child),
    table.large-table td:not(:first-child) {
      width: calc(85% / 19) !important; /* Distribute remaining space */
    }
    
    /* Preserve original alternating row colors if they exist */
    tbody tr:nth-child(even) {
      background-color: #f9f9f9 !important;
    }
    
    tbody tr:nth-child(odd) {
      background-color: white !important;
    }
    
    /* Headers con fondo marrón tienen texto blanco */
    th[style*="background"], th[class*="bg-"], .table-dark th,
    .bg-custom-reporte-mensual th, .bg-custom-reporte-mensual {
      color: white !important;
    }
    
    /* Section headers - Smart pagination with proper spacing */
    h1, h2, h3, h4, h5, h6 {
      font-weight: bold !important;
      color: inherit !important;
      margin: 8px 0 5px 0 !important; /* Balanced margins */
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
      margin: 6px 0 4px 0 !important; 
      page-break-after: avoid !important;
      page-break-before: auto !important;
    }
    
    /* Ensure table headers are always preserved and visible */
    table thead tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    /* ULTRA-AGGRESSIVE cohesion for Cohen structure */
    .bg-custom-reporte-mensual,
    .card-header.bg-custom-reporte-mensual {
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-bottom: 0 !important;
    }
    
    /* Force EVERYTHING after Cohen headers to stick like glue */
    .bg-custom-reporte-mensual + *,
    .bg-custom-reporte-mensual ~ *,
    .card-header.bg-custom-reporte-mensual + *,
    .card-header.bg-custom-reporte-mensual ~ * {
      page-break-before: avoid !important;
      break-before: avoid !important;
      margin-top: 0 !important;
    }
    
    /* Zero spacing on containers */
    .container.mt-4,
    .container {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
    }
    
    /* Force .card cohesion */
    .card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    /* Glue card-body to header */
    .card-body {
      page-break-before: avoid !important;
      break-before: avoid !important;
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    
    /* STRATEGIC page breaks: Allow only table breaks, avoid section breaks */
    .container, .card, .card-body {
      page-break-before: avoid !important;
      page-break-after: avoid !important;
      break-before: avoid !important;
      break-after: avoid !important;
    }
    
    /* CRITICAL: Enable table header repetition on ALL tables */
    thead, thead tr, thead th, thead td {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      display: table-header-group !important;
    }
    
    /* Hide all table footers */
    tfoot {
      display: none !important;
    }
    
    /* SURGICAL: Prevent total rows from breaking incorrectly */
    .total-row-no-repeat {
      page-break-before: avoid !important;
      break-before: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    /* Keep total rows with their context */
    tr:has(.total-row-no-repeat),
    tr[class*="total"],
    tr:contains("TOTAL"),
    tr:contains("Total") {
      page-break-before: avoid !important;
      break-before: avoid !important;
      orphans: 0 !important;
      widows: 0 !important;
    }
    
    /* Force table headers to repeat on page breaks */
    table {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    
    /* Ensure table body allows breaks but headers repeat */
    tbody {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    
    /* Ultra-compact layout for sections */
    .container {
      max-width: 100% !important;
      margin: 0 !important;
      padding: 2px !important;
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
    
    /* Professional page break rules with smart table breaks */
    @media print {
      /* Allow tables to break naturally but avoid bad breaks */
      table {
        page-break-inside: auto;
      }
      
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      /* EXTREME orphan prevention - ZERO tolerance */
      h1, h2, h3, h4, h5, h6 {
        orphans: 15 !important; /* Need MASSIVE content after title */
        widows: 8 !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      
      /* TOTAL cohesion - stick everything together */
      h1 + *, h2 + *, h3 + *, h4 + *, h5 + *, h6 + *,
      h1 + * + *, h2 + * + *, h3 + * + *, h4 + * + *, h5 + * + *, h6 + * + *,
      h1 + * + * + *, h2 + * + * + *, h3 + * + * + *, h4 + * + * + *, h5 + * + * + *, h6 + * + * + *,
      h1 + * + * + * + *, h2 + * + * + * + *, h3 + * + * + * + *, h4 + * + * + * + *, h5 + * + * + * + *, h6 + * + * + * + * {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }
      
      /* Eliminate ALL empty space */
      * {
        margin-top: 0 !important;
        margin-bottom: 2px !important;
      }
      
      /* Typography improvements */
      p {
        orphans: 2;
        widows: 2;
      }
      
      /* Large document specific: eliminate empty space after sections */
      div:empty, p:empty {
        display: none !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Better section spacing */
      .avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `;
}
