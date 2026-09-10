import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ExcelJS = require('exceljs');

export async function pdfToExcel(inputPath, outputPath) {
  const pdfBuf = await fs.readFile(inputPath);

  // Use pdf-lib for text extraction (already a dependency)
  const { PDFDocument } = require('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pageCount = pdfDoc.getPages().length;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Extracted Data');

  worksheet.columns = [
    { header: 'Page', key: 'page', width: 10 },
    { header: 'Content', key: 'content', width: 80 },
  ];

  // Extract text from each page using pdf-lib
  for (let i = 0; i < Math.min(pageCount, 50); i++) {
    const pageText = await pdfDoc.getPages()[i].extractText();
    worksheet.addRow({
      page: i + 1,
      content: pageText || `[Page ${i + 1} — no extractable text]`,
    });
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}
