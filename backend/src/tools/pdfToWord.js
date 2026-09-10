import fsPromises from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Document: DocxDoc, Packer, Paragraph, TextRun } = require('docx');

export async function pdfToWord(inputPath, outputPath) {
  const dataBuffer = await fsPromises.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(dataBuffer);
  const pages = pdfDoc.getPages();

  const allText = [];
  for (const page of pages) {
    try {
      const text = page.getText();
      if (text) allText.push(text);
    } catch {
      allText.push('');
    }
  }
  const textContent = allText.join('\\n');

  const docxDoc = new DocxDoc({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: textContent || '(No text extracted)',
              size: 24,
            }),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(docxDoc);
  await fsPromises.writeFile(outputPath, buffer);
  return outputPath;
}
