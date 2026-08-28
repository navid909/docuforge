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

export default async function toolRoutes(fastify, options) {
  const prisma = await import('../lib/prisma.js');

  fastify.post('/pdf-to-word', async (request, reply) => {
    const { file } = request.body || {};
    const user = request.user;
    const input = await saveUpload(file);

    try {
      const { checkRateLimit, incrementDailyUsage } = await prisma;
      const allowed = await checkRateLimit(user.id);
      if (!allowed) {
        return reply.code(429).send(errorResponse('Daily free limit reached. Upgrade to premium.'));
      }

      const outputFilename = `${crypto.randomUUID()}.docx`;
      const outputPath = path.join(TMP_DIR, outputFilename);

      const { pdfToWord } = await import('../tools/pdfToWord.js');
      await pdfToWord(input.path, outputPath);

      await incrementDailyUsage(user.id);
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
      fastify.log.error({ err, userId: user.id }, 'pdf-to-word failed');
      await cleanupUpload(input.path);
      return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
    }
  });

  fastify.post('/image-to-pdf', async (request, reply) => {
    const { file } = request.body || {};
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
      fastify.log.error({ err, userId: user.id }, 'image-to-pdf failed');
      await cleanupUpload(input.path);
      return reply.code(500).send(errorResponse('Conversion failed. Please try again.'));
    }
  });
}
