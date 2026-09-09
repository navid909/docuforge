import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

const toolSchema = z.object({
  tool: z.string().min(1),
  file: z.any().optional(),
  files: z.any().optional(),
  pages: z.string().optional(),
});

const statusParamsSchema = z.object({
  jobId: z.string().min(1),
});

const downloadParamsSchema = z.object({
  jobId: z.string().min(1),
});

const convertResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  tool: z.string(),
  createdAt: z.string(),
});

const statusResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  progress: z.number(),
  downloadUrl: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
});

function collectParts(request) {
  return new Promise((resolve, reject) => {
    const parts = [];
    (async () => {
      try {
        for await (const part of request.parts()) {
          // Store a snapshot of each part
          parts.push({
            type: part.type,
            fieldname: part.fieldname,
            filename: part.filename,
            value: part.value,
            contentType: part.contentType,
            // Store file stream reference for later reading
            _fileRef: part.file,
          });
        }
        resolve(parts);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

async function readPartToBuffer(part) {
  if (!part._fileRef) return null;
  const chunks = [];
  for await (const chunk of part._fileRef) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function apiRoutes(fastify) {
  fastify.post('/convert', async (request, reply) => {
    try {
      // Use custom collector to avoid double-iteration issues
      const parts = await collectParts(request);
      const fileParts = parts.filter((p) => p.type === 'file');
      const fieldParts = parts.filter((p) => p.type === 'field');

      // Extract tool from multipart field or query string
      let tool = null;
      for (const part of fieldParts) {
        if (part.fieldname === 'tool' && part.value) {
          tool = String(part.value);
          break;
        }
      }
      if (!tool) {
        tool = request.query?.tool || request.query?.tool_name || null;
      }

      if (!tool) {
        return reply.code(422).send({
          success: false,
          error: 'Missing tool field.',
          debug: {
            toolFromMultipart: fieldParts.filter((p) => p.fieldname === 'tool').map((p) => p.value),
            toolFromQuery: request.query?.tool || request.query?.tool_name,
            filePartsCount: fileParts.length,
          },
        });
      }

      if (fileParts.length === 0) {
        return reply.code(422).send({ success: false, error: 'Missing file in upload.' });
      }

      const firstFile = fileParts[0];
      const files = fileParts;

      const parsed = toolSchema.safeParse({ tool, file: firstFile, files, pages: null });
      if (!parsed.success) {
        return reply.code(422).send({ success: false, error: parsed.error.issues.map((e) => e.message).join(', ') });
      }

      const { tool: finalTool, file: finalFile, files: finalFiles } = parsed.data;

      const toolMap = {
        'pdf-to-word': 'pdfToWord',
        'pdf-to-excel': 'pdfToExcel',
        'pdf-to-ppt': 'pdfToPpt',
        'pdf-to-images': 'pdfToImages',
        'image-to-pdf': 'imageToPdf',
        'docx-to-pdf': 'docxToPdf',
        'xlsx-to-pdf': 'xlsxToPdf',
        'pptx-to-pdf': 'pptxToPdf',
        'merge-pdfs': 'mergePdfs',
        'split-pdf': 'splitPdf',
        'compress-pdf': 'compressPdf',
        'ocr-image': 'ocrImage',
        'protect-pdf': 'protectPdf',
        'pdf-to-image': 'pdfToImage',
      };

      const toolFn = toolMap[finalTool];
      if (!toolFn) return reply.code(400).send({ success: false, error: `Unsupported tool: ${finalTool}` });

      if (finalTool === 'merge-pdfs') {
        return handleMergePdfs(fastify, reply, finalTool, toolFn, fileParts);
      }

      try {
        const jobId = crypto.randomUUID();
        const jobDir = path.join(TMP_DIR, jobId);
        await fs.ensureDir(jobDir);

        const buffer = await readPartToBuffer(firstFile);
        if (!buffer || buffer.length === 0) {
          await fs.remove(jobDir).catch(() => {});
          return reply.code(422).send({ success: false, error: 'Uploaded file is empty.' });
        }

        const ext = path.extname(firstFile.filename || 'file') || '.bin';
        const inputPath = path.join(jobDir, `input${ext}`);
        await fs.writeFile(inputPath, buffer);

        const outputFile = path.join(jobDir, `output_${Date.now()}.bin`);
        const tools = await import('../tools/index.js');
        const result = await tools[toolFn](inputPath, outputFile);

        const outputPath = Array.isArray(result) ? result[0] : result;
        const finalName = path.basename(outputPath);

        return convertResponseSchema.parse({
          jobId,
          status: 'completed',
          tool: finalTool,
          createdAt: new Date().toISOString(),
          download: { filename: finalName, url: `/download/${jobId}/${finalName}` },
        });
      } catch (error) {
        fastify.log.error({ error, tool: finalTool }, 'Tool processing failed');
        throw error;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(422).send({ success: false, error: error.errors.map((e) => e.message).join(', ') });
      }
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'Processing failed.' });
    }
  });

  async function handleMergePdfs(fastify, reply, finalTool, toolFn, fileParts) {
    try {
      if (fileParts.length < 2) return reply.code(422).send({ success: false, error: 'Merge PDFs requires at least 2 files.' });
      const jobId = crypto.randomUUID();
      const jobDir = path.join(TMP_DIR, jobId);
      await fs.ensureDir(jobDir);
      const inputPaths = [];
      for (let i = 0; i < fileParts.length; i++) {
        const buffer = await readPartToBuffer(fileParts[i]);
        const ext = path.extname(fileParts[i].filename || 'pdf') || '.pdf';
        const inputPath = path.join(jobDir, `input_${i}${ext}`);
        await fs.writeFile(inputPath, buffer);
        inputPaths.push(inputPath);
      }
      const outputFile = path.join(jobDir, `output_${Date.now()}.pdf`);
      const tools = await import('../tools/index.js');
      const result = await tools[toolFn](inputPaths, outputFile);
      const outputPath = Array.isArray(result) ? result[0] : result;
      const finalName = path.basename(outputPath);
      return convertResponseSchema.parse({ jobId, status: 'completed', tool: finalTool, createdAt: new Date().toISOString(), download: { filename: finalName, url: `/download/${jobId}/${finalName}` } });
    } catch (error) {
      fastify.log.error({ error }, 'Merge PDFs failed');
      throw error;
    }
  }

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const jobId = statusParamsSchema.parse(request.params).jobId;
      const jobDir = path.join(TMP_DIR, jobId);
      try {
        const entries = await fs.readdir(jobDir);
        const output = entries.find((n) => n.startsWith('output_'));
        if (!output) throw new Error('No output');
        return statusResponseSchema.parse({ jobId, status: 'completed', progress: 100, downloadUrl: `/download/${jobId}/${output}`, error: null, createdAt: new Date().toISOString() });
      } catch {
        return statusResponseSchema.parse({ jobId, status: 'failed', progress: 0, downloadUrl: undefined, error: 'Not found or expired.', createdAt: new Date().toISOString() });
      }
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', ') });
      return reply.code(500).send({ success: false, error: 'Server error.' });
    }
  });

  fastify.get('/download/:jobId/*', async (request, reply) => {
    try {
      const jobId = downloadParamsSchema.parse(request.params).jobId;
      const filename = request.params['*'];
      const candidate = path.join(TMP_DIR, jobId, filename || '');
      try { await fs.stat(candidate); } catch { return reply.status(404).send({ success: false, error: 'File not found or expired.' }); }
      reply.type('application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${filename || jobId}"`);
      return fs.createReadStream(candidate);
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', ') });
      return reply.code(500).send({ success: false, error: 'Server error.' });
    }
  });
}
