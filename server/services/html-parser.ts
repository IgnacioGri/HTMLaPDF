import * as cheerio from 'cheerio';
import type { AnalysisResult } from '@shared/schema';

export function analyzeHtml(htmlContent: string): AnalysisResult {
  const $ = cheerio.load(htmlContent);
  
  // Detect Cohen report structure
  const hasCohenBranding = $('header').text().toLowerCase().includes('cohen') || 
                          $('h1, h2, h3').text().toLowerCase().includes('cohen') ||
                          $('.cohen').length > 0;

  // Count tables
  const tables = $('table');
  const tableCount = tables.length;

  // Count assets by looking for specific patterns in Cohen reports
  let assetCount = 0;
  
  // Look for asset entries in tables
  $('table tbody tr').each((i, row) => {
    const rowText = $(row).text().toLowerCase();
    // Common patterns in Cohen financial reports
    if (rowText.includes('acción') || 
        rowText.includes('bono') || 
        rowText.includes('fondo') ||
        rowText.includes('plazo fijo') ||
        rowText.includes('cedear')) {
      assetCount++;
    }
  });

  // Estimate pages based on content length and table complexity
  const contentLength = $.text().length;
  const complexTables = $('table').filter((i, table) => {
    return $(table).find('tr').length > 10; // Tables with more than 10 rows
  }).length;

  let estimatedPages = Math.ceil(contentLength / 15000); // Rough estimate
  if (complexTables > 0) {
    estimatedPages += Math.ceil(complexTables * 0.5); // Add extra for complex tables
  }

  const pageEstimate = estimatedPages <= 1 ? "1" : 
                      estimatedPages <= 3 ? `${estimatedPages}` : 
                      `${estimatedPages-1}-${estimatedPages+1}`;

  // Calculate file size
  const fileSizeBytes = Buffer.byteLength(htmlContent, 'utf8');
  const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);

  return {
    tableCount,
    assetCount: Math.max(assetCount, 0),
    estimatedPages: pageEstimate,
    isValidCohenFormat: hasCohenBranding,
    fileSize: `${fileSizeMB} MB`,
  };
}

export function injectCohenStyles(htmlContent: string): string {
  const $ = cheerio.load(htmlContent);
  
  // Inject Cohen-specific CSS for PDF generation
  const cohenStyles = `
    <style>
      @page {
        margin: 5mm;
        size: A4;
      }
      
      body {
        font-family: 'Inter', Arial, sans-serif;
        font-size: 10px;
        line-height: 1.3;
        color: #2D3748;
        margin: 0;
        padding: 0;
      }
      
      .cohen-header {
        background-color: #8B4A6B !important;
        color: white !important;
        padding: 8px 12px;
        font-weight: 600;
        border: none;
        page-break-inside: avoid;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
        font-size: 9px;
        page-break-inside: avoid;
      }
      
      th, td {
        padding: 4px 6px;
        border: 1px solid #E2E8F0;
        text-align: left;
        vertical-align: top;
      }
      
      th {
        background-color: #8B4A6B !important;
        color: white !important;
        font-weight: 600;
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      
      tbody tr:nth-child(even) {
        background-color: #F8F9FA;
      }
      
      tbody tr:nth-child(odd) {
        background-color: white;
      }
      
      .asset-group {
        page-break-inside: avoid;
        margin-bottom: 8px;
      }
      
      .section-header {
        background-color: #8B4A6B !important;
        color: white !important;
        padding: 6px 12px;
        font-weight: 600;
        margin: 10px 0 5px 0;
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      
      .page-break {
        page-break-before: always;
      }
      
      .no-break {
        page-break-inside: avoid;
      }
      
      h1, h2, h3, h4, h5, h6 {
        color: #8B4A6B;
        page-break-inside: avoid;
        page-break-after: avoid;
        margin: 8px 0 4px 0;
      }
      
      .table-header-repeat {
        display: table-header-group;
      }
      
      @media print {
        .no-print {
          display: none !important;
        }
        
        table {
          page-break-inside: auto;
        }
        
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
        thead {
          display: table-header-group;
        }
        
        tfoot {
          display: table-footer-group;
        }
      }
    </style>
  `;
  
  // Add styles to head
  if ($('head').length) {
    $('head').append(cohenStyles);
  } else {
    $('html').prepend(`<head>${cohenStyles}</head>`);
  }
  
  // Add Cohen classes to existing elements
  $('table').each((i, table) => {
    $(table).addClass('cohen-table');
    $(table).find('th').addClass('cohen-header');
    $(table).find('thead').addClass('table-header-repeat');
  });
  
  // Identify and mark section headers
  $('h1, h2, h3').each((i, header) => {
    if ($(header).text().toLowerCase().includes('resumen') ||
        $(header).text().toLowerCase().includes('tenencias') ||
        $(header).text().toLowerCase().includes('liquidez')) {
      $(header).addClass('section-header');
    }
  });
  
  return $.html();
}
