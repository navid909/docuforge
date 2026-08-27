import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { Presentation } from 'pptxgenjs';

export async function pdfToPpt(inputPath, outputPath) {
  const pdfBuf = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();

  const pptx = new Presentation();

  for (const page of pages) {
    const text = page.node.Text?.Chunks?.map(c => c.str)?.join(' ') || '';
    const slideId = pptx.addSlide();
    slideId.addText(text.slice(0, 500), {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 6.5,
      fontSize: 16,
      color: '333333',
    });
  }

  await pptx.writeFile({ fileName: outputPath });
  return outputPath;
}
