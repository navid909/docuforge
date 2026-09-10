import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

const DEPLOYED_VERSION = "v1-final-tools-fixed";

// ─── Raw multipart parser ───
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

async function readAll(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readPartToFile(part) {
  if (!part.file) return null;
  const chunks = [];
  for await (const chunk of part.file) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ─── Manual validation ───
function validateConvertInput(tool, file, files, pages) {
  const errors = [];
  if (!tool || typeof tool !== 'string' || tool.trim().length === 0) {
    errors.push('tool must be a non-empty string');
  }
  if (!file && files.length === 0) {
    errors.push('At least one file is required');
  }
  return {
    valid: errors.length === 0,
    errors,
    data: { tool: tool?.trim() || null, file, files, pages: pages || null },
  };
}

// ─── Tool dispatch ───
const TOOL_MAP = {
  'pdf-to-word': 'pdfToWord',
  'image-to-pdf': 'imageToPdf',
  'compress-pdf': 'compressPdf',
  'ocr-image': 'ocrImage',
  'pdf-to-excel': 'pdfToExcel',
  'pdf-to-ppt': 'pdfToPpt',
  'pdf-to-images': 'pdfToImages',
  'docx-to-pdf': 'docxToPdf',
  'xlsx-to-pdf': 'xlsxToPdf',
  'pptx-to-pdf': 'pptxToPdf',
  'merge-pdfs': 'mergePdfs',
  'split-pdf': 'splitPdf',
  'protect-pdf': 'protectPdf',
  'pdf-to-image': 'pdfToImage',
};

export async function apiRoutes(fastify) {
  // Load tools module once at registration
  const tools = await import('../tools/index.js');

  // Version marker
  fastify.get('/version', async () => ({ version: DEPLOYED_VERSION, deployedAt: new Date().toISOString() }));

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

  // ─── MAIN: /api/convert ───
  fastify.post('/convert', async (request, reply) => {
    try {
      // 1. Read raw body via stream
      const raw = await readAll(request.raw);
      if (raw.length === 0) {
        return reply.code(400).send({ success: false, error: 'Empty request body.', version: DEPLOYED_VERSION });
      }

      // 2. Parse multipart manually
      const ct = request.headers['content-type'] || '';
      const boundary = ct.match(/boundary=([^\s;]+)/)?.[1] || null;
      if (!boundary) {
        return reply.code(400).send({ success: false, error: 'Not multipart: missing boundary.', version: DEPLOYED_VERSION });
      }

      const parts = parseRawMultipart(raw, boundary);
      const fields = parts.filter(p => p.type === 'field');
      const fileParts = parts.filter(p => p.type === 'file');

      // 3. Extract tool (from multipart field or query param)
      let tool = null;
      for (const f of fields) {
        if (f.name === 'tool') { tool = f.value; break; }
      }
      if (!tool) tool = request.query?.tool || request.query?.tool_name || null;

      // 4. Validate manually
      const validation = validateConvertInput(tool, fileParts[0] || null, fileParts, null);
      if (!validation.valid) {
        return reply.code(422).send({
          success: false,
          error: validation.errors.join(', '),
          version: DEPLOYED_VERSION,
          debug: {
            tool,
            toolType: typeof tool,
            fields: fields.map(f => ({ name: f.name, value: f.value })),
            toolFromQuery: request.query?.tool || request.query?.tool_name,
            fileCount: fileParts.length,
          },
        });
      }

      const { tool: finalTool, file: firstFile, files: allFiles } = validation.data;

      // 5. Dispatch
      const toolFn = TOOL_MAP[finalTool];
      if (!toolFn) {
        return reply.code(400).send({ success: false, error: `Unsupported tool: ${finalTool}`, version: DEPLOYED_VERSION });
      }

      // Merge PDFs needs multiple files
      if (finalTool === 'merge-pdfs') {
        if (allFiles.length < 2) {
          return reply.code(422).send({ success: false, error: 'Merge PDFs requires at least 2 files.', version: DEPLOYED_VERSION });
        }
        return handleMerge(fastify, reply, finalTool, toolFn, allFiles);
      }

      // 6. Process single file
      const jobId = crypto.randomUUID();
      const jobDir = path.join(TMP_DIR, jobId);
      await fs.mkdir(jobDir, { recursive: true });

      const ext = path.extname(firstFile.filename || 'file') || '.bin';
      const inputPath = path.join(jobDir, `input${ext}`);
      await fs.writeFile(inputPath, firstFile.data);

      const outputFile = path.join(jobDir, `output_${Date.now()}.bin`);
      const toolMod = tools;
      const result = await toolMod[toolFn](inputPath, outputFile);

      const outPath = Array.isArray(result) ? result[0] : result;
      const finalName = path.basename(outPath);

      return {
        jobId,
        status: 'completed',
        tool: finalTool,
        createdAt: new Date().toISOString(),
        download: { filename: finalName, url: `/download/${jobId}/${finalName}` },
      };
    } catch (error) {
      fastify.log.error({ error, message: error.message, stack: error.stack }, 'Unhandled /convert error');
      return reply.code(500).send({ success: false, error: error.message || 'Processing failed.', version: DEPLOYED_VERSION });
    }
  });

  async function handleMerge(fastify, reply, tool, fn, files) {
    try {
      const jobId = crypto.randomUUID();
      const jobDir = path.join(TMP_DIR, jobId);
      await fs.mkdir(jobDir, { recursive: true });

      const inputPaths = [];
      for (let i = 0; i < files.length; i++) {
        const ext = path.extname(files[i].filename || 'pdf') || '.pdf';
        const p = path.join(jobDir, `input_${i}${ext}`);
        await fs.writeFile(p, files[i].data);
        inputPaths.push(p);
      }

      const outputFile = path.join(jobDir, `output_${Date.now()}.pdf`);
      const toolMod = tools;
      const result = await toolMod[toolFn](inputPaths, outputFile);
      const outPath = Array.isArray(result) ? result[0] : result;
      const finalName = path.basename(outPath);

      return {
        jobId, status: 'completed', tool,
        createdAt: new Date().toISOString(),
        download: { filename: finalName, url: `/download/${jobId}/${finalName}` },
      };
    } catch (error) {
      fastify.log.error({ error }, 'Merge failed');
      throw error;
    }
  }

  // ─── Status ───
  fastify.get('/status/:jobId', async (request, reply) => {
    const jobId = request.params.jobId;
    const jobDir = path.join(TMP_DIR, jobId);
    try {
      const entries = await fs.readdir(jobDir);
      const out = entries.find(n => n.startsWith('output_'));
      if (!out) throw new Error('no output');
      return { jobId, status: 'completed', progress: 100, downloadUrl: `/download/${jobId}/${out}`, error: null, createdAt: new Date().toISOString() };
    } catch {
      return { jobId, status: 'failed', progress: 0, downloadUrl: undefined, error: 'Not found or expired.', createdAt: new Date().toISOString() };
    }
  });

  // ─── Download ───
  fastify.get('/download/:jobId/*', async (request, reply) => {
    const jobId = request.params.jobId;
    const filename = request.params['*'];
    const candidate = path.join(TMP_DIR, jobId, filename || '');
    try { await fs.stat(candidate); } catch {
      return reply.status(404).send({ success: false, error: 'File not found or expired.' });
    }
    reply.type('application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${filename || jobId}"`);
    return fs.createReadStream(candidate);
  });
}
