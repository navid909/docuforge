import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';

import { errorHandler } from './middleware/errorHandler.js';
import { authHook, requirePremium } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import toolRoutes from './routes/tools.js';
import webhookRoutes from './routes/webhook.js';
import premiumRoutes from './routes/premium.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', '..', 'tmp');

async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'production' ? false : {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  await app.register(helmet, {
    crossOriginResourcePolicy: false,
  });

  await app.register(multipart, {
    fileThere: true,
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    },
    throwFileSizeLimit: true,
  });

  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: '1 minute',
  });

  app.addHook('onRequest', async (request, reply) => {
    const tmpDir = TMP_DIR;
    await fs.ensureDir(tmpDir);
    request.log.info({ path: request.url, method: request.method }, 'Incoming request');
  });

  await app.register(fastifyStatic, {
    root: TMP_DIR,
    prefix: '/download/',
    decorateReply: false,
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    },
  });

  app.setErrorHandler(errorHandler);

  app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      node_env: process.env.NODE_ENV || 'development',
    };
  });

  app.get('/version', async (request, reply) => {
    return { version: process.env.npm_package_version || '2.0.0' };
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(apiRoutes, { prefix: '/api' });
  await app.register(toolRoutes, { prefix: '/tools', preHandler: [authHook] });
  await app.register(webhookRoutes, { prefix: '/webhook' });
  await app.register(premiumRoutes, { prefix: '/premium', preHandler: [authHook] });

  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      request.log.info(`Received ${signal}, shutting down gracefully`);
      await app.close();
      process.exit(0);
    });
  });

  return app;
}

async function main() {
  console.log('Starting DocuForge backend...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET');
  console.log('REDIS_HOST:', process.env.REDIS_HOST || 'localhost');

  try {
    await fs.ensureDir(TMP_DIR);
    console.log('TMP directory ready:', TMP_DIR);
  } catch (err) {
    console.error('Failed to create TMP directory:', err);
    process.exit(1);
  }

  try {
    const app = await buildApp();
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 Server listening on http://${host}:${port}`);
    console.log(`📁 TMP directory: ${TMP_DIR}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
