import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function compressPdf(inputPath, outputPath) {
  const pdfBuffer = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });
  await fs.writeFile(outputPath, Buffer.from(pdfBytes));
  return outputPath;
}
