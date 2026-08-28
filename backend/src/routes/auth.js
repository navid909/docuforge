import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';
import crypto from 'crypto';

export const authRoutes = FastifyPluginAsyncTypebox({
  async fastify({ reply, log }) {
    const prisma = await import('../lib/prisma.js');

    // POST /auth/register
    fastify.post('/register', {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email' }),
        }),
        response: {
          201: Type.Object({
            id: Type.String(),
            email: Type.String(),
            token: Type.String(),
            premium: Type.Boolean(),
          }),
          400: Type.Object({ error: Type.String() }),
          409: Type.Object({ error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { email } = request.body;

        try {
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) {
            return reply.code(409).send({ error: 'User with this email already exists' });
          }

          const token = 'd4g_' + crypto.randomBytes(32).toString('hex');
          const keyHash = await prisma.hashApiKey(token);
          const keyPrefix = token.slice(0, 12);

          const user = await prisma.user.create({
            data: {
              email,
              passwordHash: null,
              apiKeys: {
                create: { keyHash, keyPrefix, name: 'main' },
              },
            },
            include: { apiKeys: true },
          });

          return reply.code(201).send({
            id: user.id,
            email: user.email,
            token,
            premium: false,
          });
        } catch (error) {
          log.error(error);
          return reply.code(400).send({ error: 'Failed to create user' });
        }
      },
    });

    // POST /auth/login
    fastify.post('/login', {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email' }),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            email: Type.String(),
            token: Type.String(),
            premium: Type.Boolean(),
          }),
          401: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { email } = request.body;

        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: { apiKeys: true },
          });

          if (!user) {
            return reply.code(404).send({ error: 'User not found' });
          }

          let token = user.apiKeys[0]?.keyPrefix
            ? await prisma.revealApiKey(user.apiKeys[0].keyPrefix, user.apiKeys[0].keyHash)
            : null;

          if (!token) {
            token = 'd4g_' + crypto.randomBytes(32).toString('hex');
            const keyHash = await prisma.hashApiKey(token);
            const keyPrefix = token.slice(0, 12);
            await prisma.apiKey.create({
              data: { keyHash, keyPrefix, name: 'main', userId: user.id },
            });
          }

          return reply.send({
            id: user.id,
            email: user.email,
            token,
            premium: user.isPremium || false,
          });
        } catch (error) {
          log.error(error);
          return reply.code(400).send({ error: 'Login failed' });
        }
      },
    });

    // GET /auth/me
    fastify.get('/me', {
      preHandler: [authHook],
      handler: async (request, reply) => {
        const user = request.user;
        return {
          id: user.id,
          email: user.email,
          premium: user.isPremium,
        };
      },
    });
  },
});

async function authHook(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return reply.code(401).send({ error: 'Missing token' });
  }

  try {
    const { validateApiKey, checkRateLimit } = await import('./prisma.js');
    const result = await validateApiKey(token);

    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    const allowed = await checkRateLimit(result.user.id);
    if (!allowed) {
      return reply.code(429).send({ error: 'Daily free limit reached. Upgrade to premium.' });
    }

    request.user = result.user;
    request.token = token;
  } catch (err) {
    request.log.error(err, 'Auth error');
    return reply.code(500).send({ error: 'Authentication service unavailable' });
  }
}
