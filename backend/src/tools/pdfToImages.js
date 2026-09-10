import fsPromises from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export async function pdfToImages(inputPath, outputDir) {
  const pdfBuf = await fsPromises.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();
  const outputFiles = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const imgName = `page-${i + 1}.jpg`;
    const outPath = path.join(outputDir, imgName);

    // Placeholder: create a blank image with page dimensions noted
    const width = Math.min(800, Math.max(100, Math.round(page.getWidth() / 10)));
    const height = Math.min(1000, Math.max(100, Math.round(page.getHeight() / 10)));

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

    await fsPromises.writeFile(outPath, pngBuffer);

    const jpegBuffer = await sharp(outPath).jpeg({ quality: 85 }).toBuffer();
    await fsPromises.writeFile(outPath, jpegBuffer);

    outputFiles.push(outPath);
  }

  return { outputFiles };
}
