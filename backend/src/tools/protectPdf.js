import fsPromises from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function protectPdf(inputPath, outputPath, password, mode, watermarkText, watermarkImage) {
  const pdfBuffer = await fsPromises.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  if (mode === 'watermark' || mode === 'both') {
    const watermark = watermarkText || 'Confidential';
    const context = pdfDoc.context;
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      context.save();
      context.fillColor(0.5, 0.5, 0.5, 0.3);
      context.beginPath();
      context.font('Helvetica', 24);
      context.fillText(watermark, pageWidth / 2 - 50, pageHeight / 2);
      context.restore();
    }
  }

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

  await fsPromises.writeFile(outputPath, Buffer.from(pdfBytes));
  return outputPath;
}
