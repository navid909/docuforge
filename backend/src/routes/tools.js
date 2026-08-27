import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { addConversionJob } from '../lib/queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

async function ensureTmpDir() {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

async function saveUpload(file) {
  await ensureTmpDir();
  const ext = path.extname(file.filename || 'file') || '.bin';
  const filename = `${crypto.randomUUID()}${ext}`;
  const destPath = path.join(TMP_DIR, filename);
  const stream = file.file;
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  await fs.writeFile(destPath, buffer);
  return { path: destPath, filename };
}

async function cleanupUpload(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {}
}

function downloadResponse(filePath, filename) {
  return {
    success: true,
    download: {
      filename: filename || path.basename(filePath),
      url: `/download/${path.basename(filePath)}`,
    },
  };
}

function filesResponse(files) {
  return {
    success: true,
    files: files.map(f => ({
      filename: path.basename(f),
      url: `/download/${path.basename(f)}`,
    })),
  };
}

function textResponse(text) {
  return {
    success: true,
    text: text,
  };
}

function errorResponse(message, statusCode = 400) {
  return {
    success: false,
    error: message,
  };
}

export const toolRoutes = FastifyPluginAsyncTypebox({
  async fastify({ reply, log }) {
    const prisma = await import('../lib/prisma.js');

    // Tool: PDF to Word
    fastify.post('/pdf-to-word', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PDF file' }),
          version: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.docx`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { pdfToWord } = await import('../tools/pdfToWord.js');
          await pdfToWord(input.path, outputPath);

          await prisma.incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'pdf-to-word',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'pdf-to-word failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: PDF to Excel
    fastify.post('/pdf-to-excel', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PDF file' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.xlsx`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { pdfToExcel } = await import('../tools/pdfToExcel.js');
          await pdfToExcel(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'pdf-to-excel',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'pdf-to-excel failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: PDF to PPT
    fastify.post('/pdf-to-ppt', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PDF file' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pptx`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { pdfToPpt } = await import('../tools/pdfToPpt.js');
          await pdfToPpt(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'pdf-to-ppt',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'pdf-to-ppt failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: PDF to Images
    fastify.post('/pdf-to-images', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PDF file' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            files: Type.Array(Type.Object({
              filename: Type.String(),
              url: Type.String(),
            })),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outDir = path.join(TMP_DIR, crypto.randomUUID());
          await fs.mkdir(outDir, { recursive: true });

          const { pdfToImages } = await import('../tools/pdfToImages.js');
          const result = await pdfToImages(input.path, outDir);
          const files = result.outputFiles || [];

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'pdf-to-images',
            inputFile: input.path,
            outputFiles: JSON.stringify(files.map(f => path.relative(TMP_DIR, f))),
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return filesResponse(files);
        } catch (err) {
          log.error({ err, userId: user.id }, 'pdf-to-images failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: Image to PDF
    fastify.post('/image-to-pdf', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'Image file (JPG, PNG)' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pdf`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { imageToPdf } = await import('../tools/imageToPdf.js');
          await imageToPdf(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'image-to-pdf',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'image-to-pdf failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: DOCX to PDF
    fastify.post('/docx-to-pdf', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'DOCX file' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pdf`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { docxToPdf } = await import('../tools/docxToPdf.js');
          await docxToPdf(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'docx-to-pdf',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'docx-to-pdf failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: XLSX to PDF
    fastify.post('/xlsx-to-pdf', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'XLSX file' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pdf`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { xlsxToPdf } = await import('../tools/xlsxToPdf.js');
          await xlsxToPdf(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'xlsx-to-pdf',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'xlsx-to-pdf failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: PPTX to PDF
    fastify.post('/pptx-to-pdf', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PPTX file' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pdf`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { pptxToPdf } = await import('../tools/pptxToPdf.js');
          await pptxToPdf(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'pptx-to-pdf',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'pptx-to-pdf failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
        }
      },
    });

    // Tool: Merge PDFs
    fastify.post('/merge-pdfs', {
      schema: {
        body: Type.Object({
          files: Type.Array(Type.File({ description: 'PDF files to merge' })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const user = request.user;
        const files = request.body.files || [];

        if (files.length < 2) {
          return reply.code(400).send(errorResponse('Please upload at least 2 PDF files to merge.'));
        }

        const inputs = [];
        try {
          for (const file of files) {
            inputs.push(await saveUpload(file));
          }

          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            for (const inp of inputs) await cleanupUpload(inp.path);
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pdf`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { mergePdfs } = await import('../tools/mergePdfs.js');
          await mergePdfs(inputs.map(i => i.path), outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'merge-pdfs',
            inputFiles: JSON.stringify(inputs.map(i => i.path)),
            outputFile: outputPath,
            userId: user.id,
          });

          for (const inp of inputs) await cleanupUpload(inp.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'merge-pdfs failed');
          for (const inp of inputs) await cleanupUpload(inp.path);
          return reply.code(500).send(errorResponse('Merge failed. Please try again.'));
        }
      },
    });

    // Tool: Split PDF
    fastify.post('/split-pdf', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PDF file to split' }),
          pages: Type.Optional(Type.String({ description: 'Comma-separated page numbers' })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            files: Type.Array(Type.Object({
              filename: Type.String(),
              url: Type.String(),
            })),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const user = request.user;
        const { file, pages } = request.body;
        const pagesList = pages ? pages.split(',').map(p => parseInt(p.trim())).filter(n => !isNaN(n)) : null;

        if (!pagesList || pagesList.length === 0) {
          return reply.code(400).send(errorResponse('Please specify pages to split (e.g. pages=1,2,3)'));
        }

        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            await cleanupUpload(input.path);
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outDir = path.join(TMP_DIR, crypto.randomUUID());
          await fs.mkdir(outDir, { recursive: true });

          const { splitPdf } = await import('../tools/splitPdf.js');
          const result = await splitPdf(input.path, outDir, pagesList);
          const files = result.filteredFiles || [];

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'split-pdf',
            inputFile: input.path,
            outputFiles: JSON.stringify(files.map(f => path.relative(TMP_DIR, f))),
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return filesResponse(files);
        } catch (err) {
          log.error({ err, userId: user.id }, 'split-pdf failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Split failed. Please try again.'));
        }
      },
    });

    // Tool: Compress PDF
    fastify.post('/compress-pdf', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'PDF file to compress' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            download: Type.Object({
              filename: Type.String(),
              url: Type.String(),
            }),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            await cleanupUpload(input.path);
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const outputFilename = `${crypto.randomUUID()}.pdf`;
          const outputPath = path.join(TMP_DIR, outputFilename);

          const { compressPdf } = await import('../tools/compressPdf.js');
          await compressPdf(input.path, outputPath);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'compress-pdf',
            inputFile: input.path,
            outputFile: outputPath,
            userId: user.id,
          });

          await cleanupUpload(input.path);
          return downloadResponse(outputPath, outputFilename);
        } catch (err) {
          log.error({ err, userId: user.id }, 'compress-pdf failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('Compression failed. Please try again.'));
        }
      },
    });

    // Tool: OCR Image
    fastify.post('/ocr-image', {
      schema: {
        body: Type.Object({
          file: Type.File({ description: 'Image file (JPG, PNG, TIFF)' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            text: Type.String(),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { file } = request.body;
        const user = request.user;
        const input = await saveUpload(file);

        try {
          const { checkRateLimit, incrementDailyUsage } = await prisma;
          const allowed = await checkRateLimit(user.id);
          if (!allowed) {
            await cleanupUpload(input.path);
            return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
          }

          const { ocrImage } = await import('../tools/ocrImage.js');
          const text = await ocrImage(input.path);

          await incrementDailyUsage(user.id);
          await addConversionJob({
            jobId: crypto.randomUUID(),
            tool: 'ocr-image',
            inputFile: input.path,
            userId: user.id,
            metadata: JSON.stringify({ textLength: text.length }),
          });

          await cleanupUpload(input.path);
          return textResponse(text);
        } catch (err) {
          log.error({ err, userId: user.id }, 'ocr-image failed');
          await cleanupUpload(input.path);
          return reply.code(500).send(errorResponse('OCR failed. Please try again.'));
        }
      },
    });
  },
});
