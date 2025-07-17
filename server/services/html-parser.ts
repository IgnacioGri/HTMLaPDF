import * as cheerio from 'cheerio';
import type { AnalysisResult } from '@shared/schema';

export function analyzeHtml(htmlContent: string): AnalysisResult {
  try {
    const $ = cheerio.load(htmlContent);
    
    // Detect Cohen report structure - more comprehensive detection
    const bodyText = $('body').text().toLowerCase();
    const htmlText = htmlContent.toLowerCase();
    
    // Check for Cohen-specific patterns
    const cohenPattern = htmlText.includes('cohen');
    const igjPattern = htmlText.includes('igj');
    const logoPattern = $('img[src*="cohen"]').length > 0;
    const classPattern = $('.bg-custom-reporte-mensual').length > 0;
    const reportPattern = bodyText.includes('resumen de') && bodyText.includes('para la cuenta');
    
    const hasCohenBranding = cohenPattern || igjPattern || logoPattern || classPattern || reportPattern;

    // Count tables - look for both table elements and div structures that act as tables
    const tables = $('table');
    const divTables = $('.table, .data-table, [class*="table"]').filter((i, el) => {
      return $(el).find('tr, .row').length > 0;
    });
    const tableCount = tables.length + divTables.length;

    // Count assets by looking for specific patterns in Cohen reports
    let assetCount = 0;
    
    // Look for investment assets in the content
    const content = bodyText;
    
    // Common patterns in Cohen financial reports
    const assetPatterns = [
      /acción|acciones/g,
      /bono|bonos/g,
      /fondo|fondos/g,
      /plazo fijo/g,
      /cedear/g,
      /obligación|obligaciones/g,
      /letes?/g,
      /lecap/g,
      /aluar|pampa|ypf|tenaris|galicia|macro/g // Common Argentine stocks
    ];
    
    assetPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        assetCount += matches.length;
      }
    });

    // Also count from structured data
    $('table tbody tr, .investment-row, .asset-row').each((i, row) => {
      const rowText = $(row).text().toLowerCase();
      if (rowText.includes('$') && (
          rowText.includes('acción') || 
          rowText.includes('bono') || 
          rowText.includes('fondo') ||
          rowText.includes('plazo fijo') ||
          rowText.includes('cedear') ||
          rowText.includes('lote')
        )) {
        assetCount++;
      }
    });

    // Estimate pages based on content length and complexity
    const contentLength = $.text().length;
    const complexTables = $('table').filter((i, table) => {
      return $(table).find('tr').length > 10;
    }).length;

    let estimatedPages = Math.ceil(contentLength / 12000); // Adjusted for financial reports
    if (complexTables > 0) {
      estimatedPages += Math.ceil(complexTables * 0.7); // Financial tables are denser
    }

    // Cohen reports are typically 2-8 pages
    estimatedPages = Math.max(2, Math.min(estimatedPages, 8));

    const pageEstimate = estimatedPages <= 1 ? "1" : 
                        estimatedPages <= 3 ? `${estimatedPages}` : 
                        `${estimatedPages-1}-${estimatedPages+1}`;

    // Calculate file size
    const fileSizeBytes = Buffer.byteLength(htmlContent, 'utf8');
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);

    console.log('Analysis details:', {
      contentLength,
      hasCohenBranding,
      tableCount,
      assetCount,
      estimatedPages,
      cohenInHtml: htmlText.includes('cohen'),
      igj: htmlText.includes('igj'),
      resumePattern: bodyText.includes('resumen de'),
      cuentaPattern: bodyText.includes('para la cuenta')
    });

    return {
      tableCount,
      assetCount: Math.max(assetCount, 0),
      estimatedPages: pageEstimate,
      isValidCohenFormat: hasCohenBranding,
      fileSize: `${fileSizeMB} MB`,
    };
  } catch (error) {
    console.error('HTML analysis error:', error);
    throw new Error(`Failed to analyze HTML: ${error.message}`);
  }
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
