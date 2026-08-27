import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function compressPdf(inputPath, outputPath) {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pdfBytesCompressed = await pdfDoc.save({
    useObjectStreams: false,
    compress: true,
  });

  await fs.writeFile(outputPath, pdfBytesCompressed);

  return outputPath;
}
