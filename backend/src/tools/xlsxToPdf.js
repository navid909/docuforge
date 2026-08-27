import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ExcelJS = require('exceljs');

export async function xlsxToPdf(inputPath, outputPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error('No worksheet');

  const data = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const rowData = [];
    row.eachCell({ includeEmpty: false }, (cell) => {
      rowData.push(cell.value ?? '');
    });
    if (rowData.length > 0) data.push(rowData);
  });

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let y = 720;
  const rowHeight = 18;

  if (data[0]) {
    const header = data[0].map(v => String(v).slice(0, 20)).join(' | ');
    page.drawText(header, { x: 50, y, size: 12, font });
    y -= rowHeight;
  }

  for (let i = 1; i < Math.min(data.length, 50); i++) {
    if (y < 50) break;
    const row = data[i].map(v => String(v ?? '').slice(0, 30)).join(' | ');
    page.drawText(row, { x: 50, y, size: 11, font });
    y -= rowHeight;
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}
