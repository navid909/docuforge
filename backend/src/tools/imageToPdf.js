import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument, rgb } from 'pdf-lib';

export async function imageToPdf(inputPath, outputPath) {
  const image = sharp(inputPath);
  const meta = await image.metadata();
  const format = meta.format;

  let pdfBytes;
  if (format === 'pdf') {
    // Already a PDF, just copy
    pdfBytes = await fs.readFile(inputPath);
  } else {
    // Convert image to PDF
    const pdfDoc = await PDFDocument.create();
    const imageBytes = await fs.readFile(inputPath);
    let embeddedImage;

    if (format === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else if (format === 'jpeg' || format === 'jpg') {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      // Convert to PNG first
      const pngBuffer = await sharp(inputPath).png().toBuffer();
      embeddedImage = await pdfDoc.embedPng(pngBuffer);
    }

    const page = pdfDoc.addPage([612, 792]);
    const maxWidth = 612 - 2 * 72;
    const maxHeight = 792 - 2 * 72;
    const scale = Math.min(maxWidth / embeddedImage.width, maxHeight / embeddedImage.height, 1);
    const imgWidth = embeddedImage.width * scale;
    const imgHeight = embeddedImage.height * scale;
    const x = (612 - imgWidth) / 2;
    const y = (792 - imgHeight) / 2;

    page.drawImage(embeddedImage, {
      x,
      y,
      width: imgWidth,
      height: imgHeight,
    });

    pdfBytes = await pdfDoc.save();
  }

  await fs.writeFile(outputPath, pdfBytes);
  return outputPath;
}
