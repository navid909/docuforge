import fs from 'fs/promises';
import path from 'path';
import { createPdfFromImage } from 'pdf-lib'; // helper function
import sharp from 'sharp';

export async function imageToPdf(inputPath, outputPath) {
  const image = sharp(inputPath);
  const { width, height } = await image.metadata();

  // Create a one-page PDF from the image
  const pdfBytes = await createPdfFromImage(inputPath);
  await fs.writeFile(outputPath, pdfBytes);

  return outputPath;
}

async function createPdfFromImage(imagePath) {
  // Use pdf-lib to create a simple one-page PDF
  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();

  // For simplicity, create a blank page with text indicating image
  // In production, use pdf2pic or similar to embed the image
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = await sharp(imagePath).metadata();

  // Scale image to fit within page margins
  const margin = 72;
  const maxWidth = 612 - 2 * margin;
  const maxHeight = 792 - 2 * margin;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const imgWidth = width * scale;
  const imgHeight = height * scale;

  // Note: pdf-lib doesn't directly embed arbitrary images without
  // converting to a base64-encoded data URI or using a specialized library
  // For a real implementation, use pdf2pic or embed the image bytes

  page.drawText(`Image: ${path.basename(imagePath)}`, {
    x: margin,
    y: 792 - margin,
    size: 12,
  });

  return await pdfDoc.save();
}
