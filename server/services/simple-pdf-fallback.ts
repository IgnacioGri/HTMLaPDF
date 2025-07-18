import fs from 'fs/promises';
import path from 'path';
import type { PdfConfig } from '../../shared/schema.js';

const PDF_OUTPUT_DIR = './generated-pdfs';

export async function generateSimplePdf(
  htmlContent: string,
  config: PdfConfig,
  filename: string
): Promise<string> {
  console.log('Using simple PDF fallback generator...');
  
  try {
    // Ensure output directory exists
    await fs.mkdir(PDF_OUTPUT_DIR, { recursive: true });
    
    // Clean filename
    const cleanName = filename.replace(/\.[^/.]+$/, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = `${cleanName}_${timestamp}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, pdfFilename);
    
    // Create a simple HTML-to-PDF conversion using built-in methods
    // This is a minimal fallback that creates a basic PDF structure
    const simplePdfContent = createBasicPdfStructure(htmlContent, config);
    
    // Write as HTML for now - in production this would use a server-side PDF service
    const htmlOutputPath = outputPath.replace('.pdf', '.html');
    await fs.writeFile(htmlOutputPath, simplePdfContent, 'utf8');
    
    console.log('Simple PDF fallback completed:', htmlOutputPath);
    return htmlOutputPath;
    
  } catch (error) {
    console.error('Simple PDF fallback failed:', error);
    throw new Error('All PDF generation methods failed');
  }
}

function createBasicPdfStructure(htmlContent: string, config: PdfConfig): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cohen Report</title>
  <style>
    @page {
      size: ${config.pageSize};
      margin: 10mm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      page-break-inside: auto;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 4px;
      text-align: left;
      font-size: 10px;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .page-break {
      page-break-before: always;
    }
    @media print {
      body { margin: 0; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      td { page-break-inside: avoid; page-break-after: auto; }
      th { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="cohen-report">
    <h1>Cohen Financial Report</h1>
    <p><em>Generated on ${new Date().toLocaleDateString()}</em></p>
    <hr>
    ${htmlContent}
  </div>
  
  <script>
    // Auto-print when opened (for browser PDF generation)
    window.addEventListener('load', function() {
      setTimeout(function() {
        if (window.location.search.includes('autoprint')) {
          window.print();
        }
      }, 1000);
    });
  </script>
</body>
</html>`;
}