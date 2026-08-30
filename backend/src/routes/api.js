import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

async function getFileBuffer(file) {
  if (!file || !file.file) return null;
  const chunks = [];
  for await (const chunk of file.file) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export const apiRoutes = FastifyPluginAsyncTypebox({
  async fastify({ reply, log }) {
    fastify.post('/convert', {
      schema: {
        body: Type.Object({
          tool: Type.String(),
          file: Type.Optional(Type.File()),
          files: Type.Optional(Type.Array(Type.File())),
          pages: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            jobId: Type.String(),
            status: Type.String(),
            tool: Type.String(),
            createdAt: Type.String(),
          }),
          400: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          401: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          429: Type.Object({ success: Type.Boolean(), error: Type.String() }),
          422: Type.Object({ success: Type.Boolean(), error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const body = request.body || {};
        const tool = body.tool;
        const file = body.file;
        const files = body.files;
        const pages = body.pages;

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

          return {
            jobId,
            status: 'completed',
            tool,
            createdAt: new Date().toISOString(),
            download: {
              filename: finalName,
              url: `/download/${jobId}/${finalName}`,
            },
          };
        } catch (error) {
          log.error(error);
          await fs.remove(jobDir).catch(() => {});
          return reply.code(500).send({ success: false, error: 'Processing failed.' });
        }
      },
    });

    fastify.get('/status/:jobId', {
      schema: {
        params: Type.Object({
          jobId: Type.String(),
        }),
        response: {
          200: Type.Object({
            jobId: Type.String(),
            status: Type.String(),
            progress: Type.Number(),
            downloadUrl: Type.Optional(Type.String()),
            error: Type.Optional(Type.String()),
            createdAt: Type.String(),
          }),
        },
      },
      handler: async (request, reply) => {
        const jobId = request.params.jobId;
        const jobDir = path.join(TMP_DIR, jobId);
        try {
          const entries = await fs.readdir(jobDir);
          const output = entries.find((n) => n.startsWith('output_'));
          if (!output) throw new Error('No output');
          return {
            jobId,
            status: 'completed',
            progress: 100,
            downloadUrl: `/download/${jobId}/${output}`,
            error: null,
            createdAt: new Date().toISOString(),
          };
        } catch {
          return {
            jobId,
            status: 'failed',
            progress: 0,
            downloadUrl: undefined,
            error: 'Result not found or expired.',
            createdAt: new Date().toISOString(),
          };
        }
      },
    });

    fastify.get('/download/:jobId/*', {
      schema: {
        params: Type.Object({
          jobId: Type.String(),
        }),
      },
      handler: async (request, reply) => {
        const jobId = request.params.jobId;
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
      },
    });
  },
});
