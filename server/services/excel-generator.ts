import ExcelJS from 'exceljs';
import * as cheerio from 'cheerio';

export interface ExcelGenerationResult {
  buffer: Buffer;
  filename: string;
  sheetsCreated: number;
}

export async function generateExcelFromHtml(htmlContent: string, originalFilename: string): Promise<ExcelGenerationResult> {
  const $ = cheerio.load(htmlContent);
  const workbook = new ExcelJS.Workbook();
  
  // Set workbook properties
  workbook.creator = 'Cohen PDF Generator';
  workbook.lastModifiedBy = 'Cohen PDF Generator';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  let sheetsCreated = 0;
  
  // Find all tables in the HTML
  $('table').each((tableIndex, tableElement) => {
    const $table = $(tableElement);
    const rows = $table.find('tr').toArray();
    
    if (rows.length === 0) return; // Skip empty tables
    
    // Determine sheet name based on preceding content
    let sheetName = `Tabla_${tableIndex + 1}`;
    
    // Look for section headers before this table
    const prevElements = $table.prevAll().slice(0, 5);
    for (let i = 0; i < prevElements.length; i++) {
      const text = $(prevElements[i]).text().trim();
      if (text.length > 0 && text.length < 50) {
        // Clean sheet name (Excel sheet names have restrictions)
        sheetName = text
          .replace(/[\\\/\?\*\[\]]/g, '') // Remove invalid characters
          .substring(0, 31) // Max 31 characters
          .trim();
        break;
      }
    }
    
    // Ensure unique sheet names
    let finalSheetName = sheetName;
    let counter = 1;
    while (workbook.worksheets.find(ws => ws.name === finalSheetName)) {
      finalSheetName = `${sheetName}_${counter}`;
      counter++;
    }
    
    const worksheet = workbook.addWorksheet(finalSheetName);
    sheetsCreated++;
    
    // Process table rows
    rows.forEach((row, rowIndex) => {
      const $row = $(row);
      const cells = $row.find('td, th').toArray();
      
      if (cells.length === 0) return;
      
      const excelRow = worksheet.getRow(rowIndex + 1);
      
      cells.forEach((cell, cellIndex) => {
        const $cell = $(cell);
        let cellValue = $cell.text().trim();
        
        // Try to parse numbers
        if (cellValue.match(/^[\d,.-]+$/)) {
          const numericValue = parseFloat(cellValue.replace(/[,$]/g, ''));
          if (!isNaN(numericValue)) {
            excelRow.getCell(cellIndex + 1).value = numericValue;
          } else {
            excelRow.getCell(cellIndex + 1).value = cellValue;
          }
        } else {
          excelRow.getCell(cellIndex + 1).value = cellValue;
        }
        
        // Style headers
        if ($cell.is('th') || rowIndex === 0) {
          excelRow.getCell(cellIndex + 1).font = { bold: true };
          excelRow.getCell(cellIndex + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
        }
        
        // Add borders
        excelRow.getCell(cellIndex + 1).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.values) {
        const lengths = column.values.map(v => v ? v.toString().length : 0);
        const maxLength = Math.max(...lengths.filter(v => typeof v === 'number'));
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
    });
    
    // Freeze header row
    worksheet.views = [{ state: 'frozen', ypane: 1 }];
  });
  
  // If no tables found, create a summary sheet
  if (sheetsCreated === 0) {
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.getCell('A1').value = 'No se encontraron tablas en el archivo HTML';
    summarySheet.getCell('A1').font = { bold: true };
    sheetsCreated = 1;
  }
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Generate filename
  const baseFilename = originalFilename.replace('.html', '').replace('.htm', '');
  const excelFilename = `${baseFilename}_export.xlsx`;
  
  return {
    buffer: Buffer.from(buffer),
    filename: excelFilename,
    sheetsCreated
  };
}