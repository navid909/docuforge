import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ExcelJS = require('exceljs');

export async function pdfToExcel(inputPath, outputPath) {
  const pdfBuf = await fsPromises.readFile(inputPath);

  const { PDFDocument } = require('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();
  const pageCount = Math.min(pages.length, 50);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Extracted Data');

  worksheet.columns = [
    { header: 'Page', key: 'page', width: 10 },
    { header: 'Content', key: 'content', width: 80 },
  ];

  for (let i = 0; i < pageCount; i++) {
    const page = pages[i];
    let pageText = '';
    try {
      // Try extractText on the page
      pageText = page.extractText?.() || '';
    } catch {}
    if (!pageText) {
      // Fallback: try pdfDoc-level extraction
      try {
        pageText = await pdfDoc.extractText();
      } catch {}
    }
    if (!pageText) pageText = `[Page ${i + 1} — no extractable text]`;
    worksheet.addRow({ page: i + 1, content: pageText });
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}
