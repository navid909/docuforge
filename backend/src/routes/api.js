import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';
import fs from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const BASE_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(BASE_DIR, 'tmp');

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
        const body = request.body;
        const tool = body.tool;
        const file = body.file;
        const files = body.files;
        const pages = body.pages;
        const user = request.user;

        const toolMap = {
          'pdf-to-word': '/tools/pdf-to-word',
          'pdf-to-excel': '/tools/pdf-to-excel',
          'pdf-to-ppt': '/tools/pdf-to-ppt',
          'pdf-to-images': '/tools/pdf-to-images',
          'image-to-pdf': '/tools/image-to-pdf',
          'docx-to-pdf': '/tools/docx-to-pdf',
          'xlsx-to-pdf': '/tools/xlsx-to-pdf',
          'pptx-to-pdf': '/tools/pptx-to-pdf',
          'merge-pdfs': '/tools/merge-pdfs',
          'split-pdf': '/tools/split-pdf',
          'compress-pdf': '/tools/compress-pdf',
          'ocr-image': '/tools/ocr-image',
        };

        const target = toolMap[tool];
        if (!target) {
          return reply.code(400).send({ success: false, error: `Unsupported tool: ${tool}` });
        }

        const internalUrl = `http://localhost:${process.env.PORT || 3001}${target}`;
        const formData = new FormData();
        if (file) formData.append('file', file.file, { filename: file.filename });
        if (files && files.length) {
          for (const f of files) {
            formData.append('files', f.file, { filename: f.filename });
          }
        }
        if (pages) formData.append('pages', pages);

        const res = await fetch(internalUrl, {
          method: 'POST',
          headers: {
            Authorization: request.headers.authorization || '',
          },
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return reply.status(res.status).send(data);
        }

        return {
          jobId: data.jobId || data.download?.filename || `${Date.now()}`,
          status: 'queued',
          tool,
          createdAt: new Date().toISOString(),
          ...data,
        };
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
        const candidate = path.join(TMP_DIR, jobId);
        try {
          await fs.access(candidate);
          return {
            jobId,
            status: 'completed',
            progress: 100,
            downloadUrl: `/download/${jobId}`,
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

    fastify.get('/download/:jobId', {
      schema: {
        params: Type.Object({
          jobId: Type.String(),
        }),
      },
      handler: async (request, reply) => {
        const jobId = request.params.jobId;
        const candidate = path.join(TMP_DIR, jobId);
        try {
          const stat = await fs.stat(candidate);
          if (!stat.isFile()) throw new Error('Not a file');
        } catch {
          return reply.status(404).send({ success: false, error: 'File not found or expired.' });
        }

        reply.type('application/octet-stream');
        reply.header('Content-Disposition', `attachment; filename="${jobId}"`);
        const stream = await fs.createReadStream(candidate);
        return stream;
      },
    });
  },
});
