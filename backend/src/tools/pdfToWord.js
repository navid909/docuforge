import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function pdfToWord(inputPath, outputPath) {
  const dataBuffer = await fs.readFile(inputPath);

  // Extract text from PDF using pdf-lib (already a dependency)
  const pdfDoc = await PDFDocument.load(dataBuffer);
  const textContent = await pdfDoc.extractText();

  // Create a Word document with the extracted text
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: textContent || '(No text extracted from PDF)',
                size: 24,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}
