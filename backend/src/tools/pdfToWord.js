import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph } from 'docx';

export async function pdfToWord(inputPath, outputPath) {
  const pdfBuf = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();

  let fullText = '';
  for (const page of pages) {
    const textContent = page.node?.Text?.Chunks?.map(c => c.str)?.join(' ') || '';
    if (textContent) {
      fullText += textContent + '\n\n';
    }
  }

  const doc = new Document({
    sections: [{
      children: fullText.split('\n').filter(line => line.trim()).map(line =>
        new Paragraph(line)
      ),
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}
