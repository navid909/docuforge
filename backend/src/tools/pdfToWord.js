import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function pdfToWord(inputPath, outputPath) {
  const dataBuffer = await fs.readFile(inputPath);
  const data = await pdf(dataBuffer);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: data.text || '',
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
