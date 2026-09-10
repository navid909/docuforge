import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import archiver from 'archiver';

export async function pdfToImage(inputPath, outputPath, format = 'png', pages = 'all') {
  const outputDir = path.dirname(outputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));

  const placeholderPath = path.join(outputDir, `${baseName}_page_1.${format}`);
  await fsPromises.writeFile(placeholderPath, Buffer.from('PDF rendering placeholder - implement with pdf2pic or poppler'));

  const zipPath = outputPath.replace(/\.zip$/i, '.zip');
  await createZip([placeholderPath], zipPath);
  try { await fsPromises.unlink(placeholderPath); } catch {}

  return zipPath;
}

async function createZip(files, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    for (const file of files) {
      archive.file(file, { name: path.basename(file) });
    }
    archive.finalize();
  });
}
