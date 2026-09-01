import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import archiver from 'archiver';

export async function splitPdf(inputPath, outputPath, pageRange) {
  const pdfBuffer = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  const ranges = parsePageRanges(pageRange, totalPages);
  if (!ranges.length) {
    throw new Error('No valid page ranges provided');
  }

  // For split, we create a zip containing multiple PDFs
  const outputDir = path.dirname(outputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));

  const zipFiles = [];
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    const newPdf = await PDFDocument.create();
    const indices = [];
    for (let p = start; p <= end; p++) {
      if (p < totalPages) indices.push(p);
    }
    if (!indices.length) continue;

    const copiedPages = await newPdf.copyPages(pdfDoc, indices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    const pdfBytes = await newPdf.save();

    const partPath = path.join(outputDir, `${baseName}_part${i + 1}.pdf`);
    await fs.writeFile(partPath, Buffer.from(pdfBytes));
    zipFiles.push(partPath);
  }

  // Create zip archive
  const zipPath = outputPath.replace(/\.pdf$/i, '.zip');
  await createZip(zipFiles, zipPath);

  // Cleanup individual PDFs
  for (const f of zipFiles) {
    try { await fs.unlink(f); } catch {}
  }

  return zipPath;
}

function parsePageRanges(rangeStr, maxPages) {
  const ranges = [];
  if (!rangeStr) return ranges;

  const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10) - 1; // 0-indexed
      const end = parseInt(endStr, 10) - 1;
      if (!isNaN(start) && !isNaN(end) && start <= end && end < maxPages) {
        ranges.push([start, end]);
      }
    } else {
      const page = parseInt(part, 10) - 1;
      if (!isNaN(page) && page >= 0 && page < maxPages) {
        ranges.push([page, page]);
      }
    }
  }
  return ranges;
}

async function createZip(files, outputPath) {
  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(outputPath);
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
