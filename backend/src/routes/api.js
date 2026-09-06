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

async function getFileBuffer(file) {
  if (!file || !file.file) return null;
  const chunks = [];
  for await (const chunk of file.file) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function normalizeBody(body) {
  if (!body || typeof body !== 'object') return { tool: undefined, file: undefined, files: undefined, pages: undefined };

  let tool = body.tool;
  let file = body.file;
  let files = body.files;
  let pages = body.pages;

  if (!tool || typeof tool !== 'string') {
    const fastifyFile = file || body;
    if (fastifyFile && typeof fastifyFile === 'object' && fastifyFile.filename) {
      file = fastifyFile;
    }
  }

  if (Array.isArray(body)) {
    files = body;
    file = undefined;
  }

  return { tool, file, files, pages };
}

export async function apiRoutes(fastify) {
  fastify.post('/convert', async (request, reply) => {
    try {
      const rawBody = request.body || {};
      const normalized = normalizeBody(rawBody);
      const parsed = toolSchema.parse(normalized);
      const { tool, file, files, pages } = parsed;

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

      const toolFn = toolMap[tool];
      if (!toolFn) {
        return reply.code(400).send({ success: false, error: `Unsupported tool: ${tool}` });
      }

      const needsFile = !['merge-pdfs'].includes(tool);
      const hasFile = !needsFile || (tool === 'merge-pdfs' ? files && files.length : !!file);

      if (!hasFile) {
        return reply.code(422).send({ success: false, error: 'Missing required file(s) for this tool.' });
      }

      const jobId = crypto.randomUUID();
      const jobDir = path.join(TMP_DIR, jobId);
      await fs.ensureDir(jobDir);

      try {
        const inputFiles = [];
        const outputFile = path.join(jobDir, `output_${Date.now()}.bin`);

        if (file) {
          const buffer = getFileBuffer(file);
          if (!buffer) throw new Error('Uploaded file is empty');
          const ext = path.extname(file.filename || 'file') || '.bin';
          const inputPath = path.join(jobDir, `input${ext}`);
          await fs.writeFile(inputPath, buffer);
          inputFiles.push(inputPath);
        }

        if (files && Array.isArray(files)) {
          for (const f of files) {
            const buffer = getFileBuffer(f);
            if (!buffer) continue;
            const ext = path.extname(f.filename || 'file') || '.bin';
            const inputPath = path.join(jobDir, `input_${inputFiles.length}${ext}`);
            await fs.writeFile(inputPath, buffer);
            inputFiles.push(inputPath);
          }
        }

        if (tool === 'merge-pdfs' && !inputFiles.length) {
          return reply.code(422).send({ success: false, error: 'Missing required files for merge-pdfs.' });
        }

        const tools = await import('../tools/index.js');
        const result = await tools[toolFn](
          inputFiles.length === 1 ? inputFiles[0] : inputFiles,
          outputFile
        );

        const outputPath = Array.isArray(result) ? result[0] : result;
        const finalName = path.basename(outputPath);

        const response = {
          jobId,
          status: 'completed',
          tool,
          createdAt: new Date().toISOString(),
          download: {
            filename: finalName,
            url: `/download/${jobId}/${finalName}`,
          },
        };

        return convertResponseSchema.parse(response);
      } catch (error) {
        await fs.remove(jobDir).catch(() => {});
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

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const params = statusParamsSchema.parse(request.params);
      const jobId = params.jobId;
      const jobDir = path.join(TMP_DIR, jobId);

      try {
        const entries = await fs.readdir(jobDir);
        const output = entries.find((n) => n.startsWith('output_'));
        if (!output) throw new Error('No output');

        const response = {
          jobId,
          status: 'completed',
          progress: 100,
          downloadUrl: `/download/${jobId}/${output}`,
          error: null,
          createdAt: new Date().toISOString(),
        };
        return statusResponseSchema.parse(response);
      } catch {
        const response = {
          jobId,
          status: 'failed',
          progress: 0,
          downloadUrl: undefined,
          error: 'Result not found or expired.',
          createdAt: new Date().toISOString(),
        };
        return statusResponseSchema.parse(response);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', ') });
      }
      return reply.code(500).send({ success: false, error: 'Server error.' });
    }
  });

  fastify.get('/download/:jobId/*', async (request, reply) => {
    try {
      const params = downloadParamsSchema.parse(request.params);
      const jobId = params.jobId;
      const filename = request.params['*'];
      const candidate = path.join(TMP_DIR, jobId, filename || '');

      try {
        const stat = await fs.stat(candidate);
        if (!stat.isFile()) throw new Error('Not a file');
      } catch {
        return reply.status(404).send({ success: false, error: 'File not found or expired.' });
      }

      reply.type('application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${filename || jobId}"`);
      const stream = await fs.createReadStream(candidate);
      return stream;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ success: false, error: error.errors.map((e) => e.message).join(', ') });
      }
      return reply.code(500).send({ success: false, error: 'Server error.' });
    }
  });
}
