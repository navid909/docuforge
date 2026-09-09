import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

const toolSchema = z.object({ tool: z.string().min(1), file: z.any().optional(), files: z.any().optional(), pages: z.string().optional() });
const statusParamsSchema = z.object({ jobId: z.string().min(1) });
const downloadParamsSchema = z.object({ jobId: z.string().min(1) });
const convertResponseSchema = z.object({ jobId: z.string(), status: z.string(), tool: z.string(), createdAt: z.string() });
const statusResponseSchema = z.object({ jobId: z.string(), status: z.string(), progress: z.number(), downloadUrl: z.string().optional(), error: z.string().optional(), createdAt: z.string() });

// ─── Raw multipart parser (like /dump uses) ───
function parseRawMultipart(rawBody, boundary) {
  const str = rawBody.toString('binary');
  const parts = [];
  const sections = str.split('--' + boundary);
  for (const sec of sections) {
    const trimmed = sec.trim();
    if (!trimmed || trimmed === '--') continue;
    const headerEnd = trimmed.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = trimmed.substring(0, headerEnd);
    let body = trimmed.substring(headerEnd + 4);
    if (body.endsWith('\r\n')) body = body.slice(0, -2);
    const nameM = headers.match(/name="([^"]+)"/);
    const fnM = headers.match(/filename="([^"]+)"/);
    const name = nameM ? nameM[1] : null;
    const filename = fnM ? fnM[1] : null;
    if (filename) {
      parts.push({ type: 'file', name, filename, data: Buffer.from(body, 'binary') });
    } else if (name) {
      parts.push({ type: 'field', name, value: body.trim() });
    }
  }
  return parts;
}

async function readPartToBuffer(part) {
  if (!part.file) return null;
  const chunks = [];
  for await (const chunk of part.file) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function apiRoutes(fastify) {

  // Debug: dump raw body
  fastify.post('/dump', async (request, reply) => {
    const raw = request.rawBody || (request.raw?.read ? await request.raw.read() : Buffer.from([]));
    const ct = request.headers['content-type'] || '';
    const boundary = ct.match(/boundary=([^\s;]+)/)?.[1] || 'unknown';
    const parts = boundary !== 'unknown' ? parseRawMultipart(raw, boundary) : [];
    return {
      contentType: ct,
      boundary,
      rawBodyLength: raw.length,
      rawBodyText: raw.toString('binary').substring(0, 500),
      parsedParts: parts.map(p => ({ type: p.type, name: p.name, value: p.value, filename: p.filename, size: p.data?.length })),
    };
  });

  // MAIN: use raw body parsing instead of request.parts()
  fastify.post('/convert', async (request, reply) => {
    try {
      // Read raw body
      const raw = request.rawBody || (request.raw?.read ? await request.raw.read() : Buffer.from([]));
      
      if (!raw || raw.length === 0) {
        return reply.code(400).send({ success: false, error: 'Empty request body.' });
      }

      const ct = request.headers['content-type'] || '';
      const boundary = ct.match(/boundary=([^\s;]+)/)?.[1] || null;

      if (!boundary) {
        return reply.code(400).send({ success: false, error: 'Not multipart: missing boundary in Content-Type.' });
      }

      // Parse raw body
      const parts = parseRawMultipart(raw, boundary);
      const fields = parts.filter(p => p.type === 'field');
      const files = parts.filter(p => p.type === 'file');

      // Extract tool
      let tool = null;
      for (const f of fields) {
        if (f.name === 'tool') { tool = f.value; break; }
      }
      if (!tool) {
        tool = request.query?.tool || request.query?.tool_name || null;
      }

      if (!tool) {
        return reply.code(422).send({
          success: false,
          error: 'Missing tool field.',
          diagnostic: {
            parsedFields: fields.map(f => ({ name: f.name, value: f.value })),
            toolFromQuery: request.query?.tool || request.query?.tool_name,
            fileCount: files.length,
            rawBoundary: boundary,
            rawBodyLen: raw.length,
          },
        });
      }

      if (files.length === 0) {
        return reply.code(422).send({ success: false, error: 'Missing file in upload.' });
      }

      const firstFile = files[0];

      // Validate with Zod
      const parsed = toolSchema.safeParse({ tool, file: firstFile, files, pages: null });
      if (!parsed.success) {
        return reply.code(422).send({ success: false, error: parsed.error.issues.map(e => e.message).join(', ') });
      }

      const { tool: finalTool } = parsed.data;

      // Tool dispatch map
      const toolMap = {
        'pdf-to-word': 'pdfToWord', 'image-to-pdf': 'imageToPdf', 'compress-pdf': 'compressPdf',
        'ocr-image': 'ocrImage', 'pdf-to-excel': 'pdfToExcel', 'pdf-to-ppt': 'pdfToPpt',
        'pdf-to-images': 'pdfToImages', 'docx-to-pdf': 'docxToPdf', 'xlsx-to-pdf': 'xlsxToPdf',
        'pptx-to-pdf': 'pptxToPdf', 'merge-pdfs': 'mergePdfs', 'split-pdf': 'splitPdf',
        'protect-pdf': 'protectPdf', 'pdf-to-image': 'pdfToImage',
      };

      const toolFn = toolMap[finalTool];
      if (!toolFn) return reply.code(400).send({ success: false, error: `Unsupported tool: ${finalTool}` });

      // Merge PDFs (multiple files)
      if (finalTool === 'merge-pdfs') {
        if (files.length < 2) return reply.code(422).send({ success: false, error: 'Merge PDFs needs 2+ files.' });
        return handleMerge(fastify, reply, finalTool, toolFn, files);
      }

      // Single file tools
      try {
        const jobId = crypto.randomUUID();
        const jobDir = path.join(TMP_DIR, jobId);
        await fs.ensureDir(jobDir);

        // Write uploaded file to disk
        const ext = path.extname(firstFile.filename || 'file') || '.bin';
        const inputPath = path.join(jobDir, `input${ext}`);
        await fs.writeFile(inputPath, firstFile.data);

        const outputFile = path.join(jobDir, `output_${Date.now()}.bin`);
        const tools = await import('../tools/index.js');
        const result = await tools[toolFn](inputPath, outputFile);

        const outputPath = Array.isArray(result) ? result[0] : result;
        const finalName = path.basename(outputPath);

        return convertResponseSchema.parse({
          jobId, status: 'completed', tool: finalTool, createdAt: new Date().toISOString(),
          download: { filename: finalName, url: `/download/${jobId}/${finalName}` },
        });
      } catch (error) {
        fastify.log.error({ error, tool: finalTool }, 'Tool processing failed');
        throw error;
      }
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(422).send({ success: false, error: error.errors.map(e => e.message).join(', ') });
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'Processing failed.' });
    }
  });

  async function handleMerge(fastify, reply, tool, fn, files) {
    try {
      const jobId = crypto.randomUUID();
      const jobDir = path.join(TMP_DIR, jobId);
      await fs.ensureDir(jobDir);

      const inputPaths = [];
      for (let i = 0; i < files.length; i++) {
        const ext = path.extname(files[i].filename || 'pdf') || '.pdf';
        const p = path.join(jobDir, `input_${i}${ext}`);
        await fs.writeFile(p, files[i].data);
        inputPaths.push(p);
      }

      const outputFile = path.join(jobDir, `output_${Date.now()}.pdf`);
      const tools = await import('../tools/index.js');
      const result = await fn(inputPaths, outputFile);
      const outPath = Array.isArray(result) ? result[0] : result;
      return convertResponseSchema.parse({
        jobId, status: 'completed', tool, createdAt: new Date().toISOString(),
        download: { filename: path.basename(outPath), url: `/download/${jobId}/${path.basename(outPath)}` },
      });
    } catch (error) {
      fastify.log.error({ error }, 'Merge failed');
      throw error;
    }
  }

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const jobId = statusParamsSchema.parse(request.params).jobId;
      const jobDir = path.join(TMP_DIR, jobId);
      try {
        const entries = await fs.readdir(jobDir);
        const out = entries.find(n => n.startsWith('output_'));
        if (!out) throw new Error('no output');
        return statusResponseSchema.parse({
          jobId, status: 'completed', progress: 100,
          downloadUrl: `/download/${jobId}/${out}`, error: null,
          createdAt: new Date().toISOString(),
        });
      } catch {
        return statusResponseSchema.parse({
          jobId, status: 'failed', progress: 0,
          downloadUrl: undefined, error: 'Not found or expired.',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      if (e instanceof z.ZodError) return reply.code(400).send({ success: false, error: e.errors.map(x => x.message).join(', ') });
      return reply.code(500).send({ success: false, error: 'Server error.' });
    }
  });

  fastify.get('/download/:jobId/*', async (request, reply) => {
    try {
      const jobId = downloadParamsSchema.parse(request.params).jobId;
      const filename = request.params['*'];
      const candidate = path.join(TMP_DIR, jobId, filename || '');
      try { await fs.stat(candidate); } catch { return reply.status(404).send({ success: false, error: 'Not found or expired.' }); }
      reply.type('application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${filename || jobId}"`);
      return fs.createReadStream(candidate);
    } catch (e) {
      if (e instanceof z.ZodError) return reply.code(400).send({ success: false, error: e.errors.map(x => x.message).join(', ') });
      return reply.code(500).send({ success: false, error: 'Error.' });
    }
  });
}
