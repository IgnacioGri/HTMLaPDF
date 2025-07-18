import * as htmlPdf from 'html-pdf-node';
import type { PdfConfig } from '../../shared/schema.js';

export async function generatePdfWithFallback(
  htmlContent: string,
  config: PdfConfig,
  outputPath: string
): Promise<void> {
  console.log('Using fallback HTML-PDF generator...');
  
  const options = {
    format: config.pageSize,
    orientation: config.orientation,
    margin: {
      top: '5mm',
      right: '5mm',
      bottom: '5mm',
      left: '5mm'
    },
    printBackground: true,
    preferCSSPageSize: false
  };

  // Inject enhanced CSS for Cohen reports
  const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: A4 landscape;
          margin: 5mm;
        }
        
        body {
          font-family: Arial, sans-serif !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 2px 0 !important;
          font-size: 10px !important;
        }
        
        table th, table td {
          padding: 2px 4px !important;
          border: 1px solid #ccc !important;
          vertical-align: top !important;
        }
        
        table thead {
          display: table-header-group !important;
          background-color: #f5f5f5 !important;
        }
        
        /* Preserve original colors */
        .blue-text, .title-blue {
          color: #0066cc !important;
        }
        
        /* Dynamic sizing based on content */
        .container {
          max-width: 100% !important;
          overflow: hidden !important;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  try {
    const file = { content: styledHtml };
    const pdfBuffer = await htmlPdf.generatePdf(file, options);
    
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, pdfBuffer);
    
    console.log('PDF generated successfully with fallback method');
  } catch (error) {
    console.error('Fallback PDF generation failed:', error);
    throw error;
  }
}