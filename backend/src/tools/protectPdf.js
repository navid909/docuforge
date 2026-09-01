import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export async function protectPdf(inputPath, outputPath, password, mode, watermarkText, watermarkImage) {
  const pdfBuffer = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Apply watermark if requested
  if (mode === 'watermark' || mode === 'both') {
    const watermark = watermarkText || 'Confidential';
    const pages = pdfDoc.getPages();
    for (const page of pages) {[0].getWidth();
      const pageHeight = page.getHeight();
      page.drawText(watermark, {
        x: pageWidth / 2 - 50,
        y: pageHeight / 2,
        size: 24,
        color: pdfDoc.context.operators.rgb(0.5, 0.5, 0.5),
      });
    }
  }

  // Encrypt the PDF
  const pdfBytes = await pdfDoc.save({
    userPassword: password,
    ownerPassword: password + '_owner',
    permissions: {
      printing: 'lowResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      accessibilityExtraction: false,
      assembling: false,
      printDegraded: true,
    },
  });

  await fs.writeFile(outputPath, Buffer.from(pdfBytes));
  return outputPath;
}
