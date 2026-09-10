import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const mammoth = require('mammoth');

export async function docxToPdf(inputPath, outputPath) {
  const result = await mammoth.extractRawText({ path: inputPath });
  const text = result.value;

  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const lines = text.split('\\n');
  let yPos = 720;
  const lineHeight = 15;

  for (let i = 0; i < lines.length && yPos > 50; i++) {
    const line = lines[i]?.trim();
    if (line) {
      const displayLine = line.length > 100 ? line.slice(0, 100) : line;
      page.drawText(displayLine, {
        x: 72,
        y: yPos,
        size: 11,
        font,
      });
    }
    yPos -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  await fsPromises.writeFile(outputPath, pdfBytes);
  return outputPath;
}
