import fs from 'fs/promises';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument } from 'pdf-lib';

export async function pdfToWord(inputPath, outputPath) {
  // Read and extract text from PDF using pdf-lib (already a dependency)
  const dataBuffer = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(dataBuffer);
  const text = await pdfDoc.extractText();

  // Build Word document from extracted text
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: text || '',
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
