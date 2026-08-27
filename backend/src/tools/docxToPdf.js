import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const mammoth = require('mammoth');
const fs = require('fs/promises');

export async function docxToPdf(inputPath, outputPath) {
  const result = await mammoth.extractRawText({ path: inputPath });
  const text = result.value;

  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const lines = text.split('\n');
  let yPos = 720;
  const lineHeight = 15;

  for (let i = 0; i < lines.length && yPos > 50; i++) {
    const line = lines[i]?.trim();
    if (line) {
      page.drawText(line.length > 100 ? line.slice(0, 100) : line, {
        x: 72,
        y: yPos,
        size: 11,
        font,
      });
    }
    yPos -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  return outputPath;
}
