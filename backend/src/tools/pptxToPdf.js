import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

export async function pptxToPdf(inputPath, outputPath) {
  const { Presentation } = await import('pptxgenjs');
  const pptx = new Presentation();
  await pptx.readFile(inputPath);

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesBold);

  let pageIndex = 0;
  for (const slide of pptx.slides) {
    if (pageIndex >= 100) break;

    const pdfPage = pdfDoc.addPage([612, 792]);
    let yPos = 720;

    // Collect all text from shapes
    const texts = [];
    for (const shape of slide.shapes) {
      if (shape && shape.options?.text) {
        texts.push(shape.options.text);
      }
    }

    // Title
    if (texts[0] && yPos > 50) {
      pdfPage.drawText(texts[0].slice(0, 110), {
        x: 72,
        y: yPos,
        size: 18,
        font: boldFont,
        color: rgb(0.05, 0.05, 0.05),
      });
      yPos -= 32;
    }

    // Body
    for (let i = 1; i < texts.length && yPos > 50; i++) {
      const text = texts[i] || '';
      const lines = text.split('\n');
      for (const line of lines) {
        if (yPos < 50) break;
        const truncated = line.length > 120 ? line.slice(0, 120) : line;
        pdfPage.drawText(truncated, {
          x: 72,
          y: yPos,
          size: 12,
          font: helvetica,
        });
        yPos -= 16;
      }
      yPos -= 8;
    }

    pageIndex++;
  }

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}
