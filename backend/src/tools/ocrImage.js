import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export async function ocrImage(inputPath, outputPath) {
  // Placeholder OCR: extract basic metadata and write text file
  const meta = await sharp(inputPath).metadata();
  const text = `Image metadata: ${JSON.stringify(meta, null, 2)}`;

  await fs.writeFile(outputPath, text, 'utf-8');
  return outputPath;
}
