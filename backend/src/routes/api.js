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

async function readPartToBuffer(part) {
  if (!part.file) return null;
  const chunks = [];
  for await (const chunk of part.file) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function apiRoutes(fastify) {
  fastify.post('/convert', async (request, reply) => {
    try {
      // Collect ALL parts via iterator (v8+ API)
      const parts = [];
      for await (const part of request.parts()) {
        parts.push(part);
      }

      // Parse fields and files from collected parts
      let tool = null;
      let pages = null;
      const fileParts = [];

      for (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'tool' && part.value) {
            tool = String(part.value);
          }
          if (part.fieldname === 'pages' && part.value) {
            pages = String(part.value);
          }
        } else if (part.type === 'file') {
          fileParts.push(part);
        }
      }

      if (!tool) {
        return reply.code(422).send({
          success: false,
          error: 'Missing tool field in multipart form.',
          hint: 'Send tool field as multipart field alongside file.',
        });
      }
      if (fileParts.length === 0) {
        return reply.code(422).send({
          success: false,
          error: 'Missing file in multipart upload.',
        });
      }

      const firstFile = fileParts[0];

      const parsed = toolSchema.safeParse({ tool, file: firstFile, files: fileParts, pages });
      if (!parsed.success) {
        return reply.code(422).send({ success: false, error: parsed.error.issues.map((e) => e.message).join(', ') });
      }

      const { tool: finalTool, file: finalFile, files: finalFiles, pages: finalPages } = parsed.data;

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
      if (!toolFn) {
        return reply.code(400).send({ success: false, error: `Unsupported tool: ${finalTool}` });
      }

      // Merge PDFs — needs multiple files
      if (finalTool === 'merge-pdfs') {
        return handleMergePdfs(fastify, reply, finalTool, toolFn, fileParts);
      }

      // Single file tools
      try {
        const jobId = crypto.randomUUID();
        const jobDir = path.join(TMP_DIR, jobId);
        await fs.ensureDir(jobDir);

        const buffer = await readPartToBuffer(finalFile);
        if (!buffer || buffer.length === 0) {
          await fs.remove(jobDir).catch(() => {});
          return reply.code(422).send({ success: false, error: 'Uploaded file is empty.' });
        }

        const ext = path.extname(finalFile.filename || 'file') || '.bin';
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
          download: {
            filename: finalName,
            url: `/download/${jobId}/${finalName}`,
          },
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

  // Merge PDFs — multiple files
  async function handleMergePdfs(fastify, reply, finalTool, toolFn, fileParts) {
    try {
      if (fileParts.length < 2) {
        return reply.code(422).send({ success: false, error: 'Merge PDFs requires at least 2 PDF files.' });
      }

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

      return convertResponseSchema.parse({
        jobId,
        status: 'completed',
        tool: finalTool,
        createdAt: new Date().toISOString(),
        download: {
          filename: finalName,
          url: `/download/${jobId}/${finalName}`,
        },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Merge PDFs failed');
      throw error;
    }
  }

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const params = statusParamsSchema.parse(request.params);
      const jobId = params.jobId;
      const jobDir = path.join(TMP_DIR, jobId);

      try {
        const entries = await fs.readdir(jobDir);
        const output = entries.find((n) => n.startswith('output_'));
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
