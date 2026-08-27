import path from 'path';
import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export async function pdfToImages(inputPath, outputDir) {
  const pdfBuf = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();
  const outputFiles = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const imgName = `page-${i + 1}.jpg`;
    const outPath = path.join(outputDir, imgName);

    // For production, use pdf2pic or puppeteer to render pages as images
    // Placeholder: create a blank image with page dimensions noted
    const width = Math.min(800, Math.max(100, Math.round(page.node.width / 10)));
    const height = Math.min(1000, Math.max(100, Math.round(page.node.height / 10)));

    const pngBuffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 240, g: 240, b: 240, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    await fs.writeFile(outPath, pngBuffer);

    // Convert PNG to JPEG
    const jpegBuffer = await sharp(outPath).jpeg({ quality: 85 }).toBuffer();
    await fs.writeFile(outPath, jpegBuffer);

    outputFiles.push(outPath);
  }

  return { outputFiles };
}
