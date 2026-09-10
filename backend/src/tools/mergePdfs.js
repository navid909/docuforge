import fsPromises from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function mergePdfs(inputFiles, outputPath) {
  if (!inputFiles || !inputFiles.length) {
    throw new Error('mergePdfs requires input files');
  }

  const mergedPdf = await PDFDocument.create();

  for (const filePath of inputFiles) {
    const pdfBytes = await fsPromises.readFile(filePath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  await fsPromises.writeFile(outputPath, pdfBytes);
  return outputPath;
}
