import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(inputPaths, outputPath) {
  const mergedPdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const pdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    const [copiedPages] = await mergedPdf.copyPages(pdfDoc, pages.map((_, i) => i));
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  await fs.writeFile(outputPath, pdfBytes);

  return { outputFile: outputPath };
}
