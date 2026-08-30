import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(inputFiles, outputPath) {
  if (!inputFiles || !inputFiles.length) {
    throw new Error('mergePdfs requires input files');
  }

  const mergedPdf = await PDFDocument.create();

  for (const filePath of inputFiles) {
    const pdfBytes = await fs.readFile(filePath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  await fs.writeFile(outputPath, pdfBytes);
  return outputPath;
}
