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
  
  // Minimal modifications to preserve original HTML appearance
  
  // Just add classes for table optimization without changing visual style
  $('table').each((i, table) => {
    const $table = $(table);
    const colCount = $table.find('tr').first().find('td, th').length;
    
    // Add classes for CSS targeting only
    if (colCount >= 6) {
      $table.addClass('main-table wide-table');
    } else if (colCount >= 3) {
      $table.addClass('main-table');
    } else {
      $table.addClass('summary-table');
    }
    
    // Mark investment detail rows for page break optimization
    $table.find('tr').each((j, row) => {
      const rowText = $(row).text().toLowerCase();
      if (rowText.includes('lote') && rowText.includes('/')) {
        $(row).addClass('detail-row');
      } else if (rowText.includes('$') || rowText.includes('u$s')) {
        $(row).addClass('main-row');
      }
    });
  });
  
  // Add section classes only for page break management
  $('*').each((i, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('tenencias al') || text.includes('resumen de') || text.includes('movimientos entre')) {
      $(el).addClass('section-header avoid-break');
    }
    if (text.includes('renta fija') || text.includes('renta variable') || text.includes('acciones argentinas')) {
      $(el).addClass('investment-group avoid-break');
    }
  });
  
  // Remove the old style tag if exists and replace with optimized one
  $('style').remove();
  
  // Inject minimal Cohen-specific CSS - main styling will come from generateCustomCSS
  const cohenStyles = `
    <style>
      /* Basic Cohen branding - detailed styles applied via page.addStyleTag */
      .cohen-header {
        background-color: #8B0000 !important;
        color: white !important;
        padding: 8px 12px;
        font-weight: 600;
        text-align: center;
      }
      
      /* Ensure all tables are marked for processing */
      table {
        border-collapse: collapse !important;
        width: 100% !important;
      }
      
      /* Initial sizing to prevent overflow */
      body {
        max-width: 210mm;
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }
    </style>
  `;
  
  // Add styles to head
  if ($('head').length) {
    $('head').append(cohenStyles);
  } else {
    $('html').prepend(`<head>${cohenStyles}</head>`);
  }
  
  return $.html();
}
