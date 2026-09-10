import fsPromises from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function pdfToExcel(inputPath, outputPath) {
  const pdfBuf = await fsPromises.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();
  const pageLimit = Math.min(pages.length, 50);

  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Extracted Data');
  ws.columns = [
    { header: 'Page', key: 'page', width: 10 },
    { header: 'Content', key: 'content', width: 80 },
  ];

  for (let i = 0; i < pageLimit; i++) {
    const page = pages[i];
    let text = '';
    try { text = page.getText(); } catch {}
    if (!text) text = `[Page ${i + 1} — no extractable text]`;
    ws.addRow({ page: i + 1, content: text });
  }

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}
