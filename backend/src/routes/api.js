import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { z } from 'zod';

// readAll polyfill for Node.js versions that don't have it in node:stream/consumers
async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

// ─── VISIBLE MARKER: this exact string proves this version is deployed ───
const DEPLOYED_VERSION = 'RAW-BODY-FIX-ddff1a0';

const toolSchema = z.object({ tool: z.string().min(1), file: z.any().optional(), files: z.any().optional(), pages: z.string().optional() });
const statusParamsSchema = z.object({ jobId: z.string().min(1) });
const downloadParamsSchema = z.object({ jobId: z.string().min(1) });
const convertResponseSchema = z.object({ jobId: z.string(), status: z.string(), tool: z.string(), createdAt: z.string() });
const statusResponseSchema = z.object({ jobId: z.string(), status: z.string(), progress: z.number(), downloadUrl: z.string().optional(), error: z.string().optional(), createdAt: z.string() });

// Parse raw multipart body
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

  // VISIBLE MARKER endpoint
  fastify.get('/version', async () => {
    return { version: DEPLOYED_VERSION, deployedAt: new Date().toISOString() };
  });

  // Debug: dump raw body
  fastify.post('/dump', async (request, reply) => {
    const raw = await readAll(request.raw);
    const ct = request.headers['content-type'] || '';
    const boundary = ct.match(/boundary=([^\s;]+)/)?.[1] || 'unknown';
    const parts = boundary !== 'unknown' ? parseRawMultipart(raw, boundary) : [];
    return {
      version: DEPLOYED_VERSION,
      contentType: ct,
      boundary,
      rawBodyLength: raw.length,
      rawBodyText: raw.toString('binary').substring(0, 500),
      parsedParts: parts.map(p => ({ type: p.type, name: p.name, value: p.value, filename: p.filename, size: p.data?.length })),
      query: request.query,
    };
  });

  // MAIN: read raw body as stream, parse manually
  fastify.post('/convert', async (request, reply) => {
    try {
      // DEBUG: dump request state at handler entry
      const entryDebug = {
        url: request.url,
        method: request.method,
        query: request.query,
        headers: {
          'content-type': request.headers['content-type'],
          'content-length': request.headers['content-length'],
        },
      };

      // READ RAW BODY (same pattern as /dump)
      const raw = await readAll(request.raw);
      const rawLen = raw.length;

      if (rawLen === 0) {
        return reply.code(422).send({
          success: false,
          error: 'Empty request body.',
          version: DEPLOYED_VERSION,
          entryDebug,
        });
      }

      const ct = request.headers['content-type'] || '';
      const boundary = ct.match(/boundary=([^\s;]+)/)?.[1] || null;

      if (!boundary) {
        return reply.code(400).send({ success: false, error: 'Not multipart: missing boundary.', version: DEPLOYED_VERSION, entryDebug });
      }

      const parts = parseRawMultipart(raw, boundary);
      const fields = parts.filter(p => p.type === 'field');
      const files = parts.filter(p => p.type === 'file');

      // Extract tool from multipart fields
      let tool = null;
      for (const f of fields) {
        if (f.name === 'tool') { tool = f.value; break; }
      }
      // Fallback: query param
      if (!tool) tool = request.query?.tool || request.query?.tool_name || null;

      // DEBUG: show what we have before Zod
      const preZodDebug = {
        tool,
        toolType: typeof tool,
        toolValue: tool,
        fields: fields.map(f => ({ name: f.name, value: f.value })),
        toolFromQuery: request.query?.tool || request.query?.tool_name,
        fileCount: files.length,
        rawLen,
        rawFirst200: raw.toString('binary').substring(0, 200),
      };

      if (!tool) {
        return reply.code(422).send({
          success: false,
          error: 'Missing tool field.',
          version: DEPLOYED_VERSION,
          preZodDebug,
        });
      }

      if (files.length === 0) {
        return reply.code(422).send({ success: false, error: 'Missing file in upload.', version: DEPLOYED_VERSION, preZodDebug });
      }

      const firstFile = files[0];

      // HARDcoded test: bypass all logic and pass string directly to Zod
      const hardcodedTest = toolSchema.safeParse({ tool: 'image-to-pdf-hardcoded', file: null, files: [], pages: null });
      if (!hardcodedTest.success) {
        return reply.code(500).send({ 
          success: false, 
          error: 'Zod itself is broken — hardcoded string failed: ' + hardcodedTest.error.issues.map(e => e.message).join(', '),
          version: DEPLOYED_VERSION,
        });
      }

      // DEBUG: show what Zod receives — explicit every field
      const zodInput = { tool, file: firstFile, files, pages: null };
      
      const zodFieldDebug = {
        tool: { value: zodInput.tool, type: typeof zodInput.tool, isNull: zodInput.tool === null, isUndefined: zodInput.tool === undefined },
        file: { present: !!zodInput.file, hasFilename: zodInput.file?.filename || null, hasData: !!zodInput.file?.data, dataLength: zodInput.file?.data?.length || 0 },
        files: { count: zodInput.files.length, firstHasData: zodInput.files[0]?.data ? true : false },
        pages: zodInput.pages,
      };

      const parsed = toolSchema.safeParse(zodInput);
      if (!parsed.success) {
        const issueDetails = parsed.error.issues.map(e => ({ 
          code: e.code, 
          message: e.message, 
          path: e.path, 
          expected: e.expected, 
          received: e.received 
        }));
        return reply.code(422).send({ 
          success: false, 
          error: parsed.error.issues.map(e => e.message).join(', '), 
          version: DEPLOYED_VERSION,
          zodFieldDebug,
          preZodDebug,
          issueDetails,
        });
      }

      const { tool: finalTool } = parsed.data;

      const toolMap = {
        'pdf-to-word': 'pdfToWord', 'image-to-pdf': 'imageToPdf', 'compress-pdf': 'compressPdf',
        'ocr-image': 'ocrImage', 'pdf-to-excel': 'pdfToExcel', 'pdf-to-ppt': 'pdfToPpt',
        'pdf-to-images': 'pdfToImages', 'docx-to-pdf': 'docxToPdf', 'xlsx-to-pdf': 'xlsxToPdf',
        'pptx-to-pdf': 'pptxToPdf', 'merge-pdfs': 'mergePdfs', 'split-pdf': 'splitPdf',
        'protect-pdf': 'protectPdf', 'pdf-to-image': 'pdfToImage',
      };

      const toolFn = toolMap[finalTool];
      if (!toolFn) return reply.code(400).send({ success: false, error: `Unsupported tool: ${finalTool}`, version: DEPLOYED_VERSION });

      if (finalTool === 'merge-pdfs') {
        if (files.length < 2) return reply.code(422).send({ success: false, error: 'Merge needs 2+ files.', version: DEPLOYED_VERSION });
        return handleMerge(fastify, reply, finalTool, toolFn, files);
      }

      try {
        const jobId = crypto.randomUUID();
        const jobDir = path.join(TMP_DIR, jobId);
        await fs.ensureDir(jobDir);

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
        fastify.log.error({ error, tool: finalTool }, 'Tool failed');
        throw error;
      }
    } catch (error) {
      if (error instanceof z.ZodError) return reply.code(422).send({ success: false, error: error.errors.map(e => e.message).join(', '), version: DEPLOYED_VERSION });
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'Processing failed.', version: DEPLOYED_VERSION });
    }
  });

  async function handleMerge(fastify, reply, tool, fn, files) {
    try {
      const jobId = crypto.randomUUID();
      const jobDir = path.join(TMP_DIR, jobId);
      await fs.ensureDir(jobDir);
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        const ext = path.extname(files[i].filename || 'pdf') || '.pdf';
        const p = path.join(jobDir, `input_${i}${ext}`);
        await fs.writeFile(p, files[i].data);
        paths.push(p);
      }
      const out = path.join(jobDir, `output_${Date.now()}.pdf`);
      const tools = await import('../tools/index.js');
      const result = await fn(paths, out);
      const outPath = Array.isArray(result) ? result[0] : result;
      return convertResponseSchema.parse({ jobId, status: 'completed', tool, createdAt: new Date().toISOString(), download: { filename: path.basename(outPath), url: `/download/${jobId}/${path.basename(outPath)}` } });
    } catch (error) { fastify.log.error({ error }, 'Merge failed'); throw error; }
  }

  fastify.get('/status/:jobId', async (request, reply) => {
    try {
      const jobId = statusParamsSchema.parse(request.params).jobId;
      const jobDir = path.join(TMP_DIR, jobId);
      try {
        const entries = await fs.readdir(jobDir);
        const out = entries.find(n => n.startsWith('output_'));
        if (!out) throw new Error('no output');
        return statusResponseSchema.parse({ jobId, status: 'completed', progress: 100, downloadUrl: `/download/${jobId}/${out}`, error: null, createdAt: new Date().toISOString() });
      } catch { return statusResponseSchema.parse({ jobId, status: 'failed', progress: 0, downloadUrl: undefined, error: 'Not found.', createdAt: new Date().toISOString() }); }
    } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ success: false, error: e.errors.map(x => x.message).join(', ') }); return reply.code(500).send({ success: false, error: 'Error.' }); }
  });

  fastify.get('/download/:jobId/*', async (request, reply) => {
    try {
      const jobId = downloadParamsSchema.parse(request.params).jobId;
      const filename = request.params['*'];
      const candidate = path.join(TMP_DIR, jobId, filename || '');
      try { await fs.stat(candidate); } catch { return reply.status(404).send({ success: false, error: 'Not found.' }); }
      reply.type('application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${filename || jobId}"`);
      return fs.createReadStream(candidate);
    } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ success: false, error: e.errors.map(x => x.message).join(', ') }); return reply.code(500).send({ success: false, error: 'Error.' }); }
  });
}
