import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';
import crypto from 'crypto';

export const authRoutes = FastifyPluginAsyncTypebox({
  async fastify({ reply, log }) {
    const prisma = await import('../lib/prisma.js');

    // POST /auth/signup
    fastify.post('/signup', {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email' }),
        }),
        response: {
          201: Type.Object({
            success: Type.Boolean(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
            }),
            apiKey: Type.String(),
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

          const apiKey = 'd4g_' + crypto.randomBytes(32).toString('hex');
          const keyHash = await prisma.hashApiKey(apiKey);
          const keyPrefix = apiKey.slice(0, 12);

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
            success: true,
            user: { id: user.id, email: user.email },
            apiKey,
          });
        } catch (error) {
          log.error(error);
          return reply.code(400).send({ error: 'Failed to create user' });
        }
      },
    });

    // POST /auth/login - email only, no password
    fastify.post('/login', {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email' }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
            }),
            apiKey: Type.String(),
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

          let apiKey = user.apiKeys[0]?.keyPrefix
            ? await prisma.revealApiKey(user.apiKeys[0].keyPrefix, user.apiKeys[0].keyHash)
            : null;

          if (!apiKey) {
            apiKey = 'd4g_' + crypto.randomBytes(32).toString('hex');
            const keyHash = await prisma.hashApiKey(apiKey);
            const keyPrefix = apiKey.slice(0, 12);
            await prisma.apiKey.create({
              data: { keyHash, keyPrefix, name: 'main', userId: user.id },
            });
          }

          return reply.send({
            success: true,
            user: { id: user.id, email: user.email },
            apiKey,
            premium: user.isPremium || false,
          });
        } catch (error) {
          log.error(error);
          return reply.code(400).send({ error: 'Login failed' });
        }
      },
    });

    // POST /auth/api-key (validate API key)
    fastify.post('/api-key', {
      schema: {
        body: Type.Object({
          apiKey: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
              isPremium: Type.Boolean(),
              dailyUsed: Type.Number(),
              dailyResetAt: Type.String(),
            }),
          }),
          401: Type.Object({ error: Type.String() }),
        },
      },
      handler: async (request, reply) => {
        const { apiKey } = request.body;

        const result = await prisma.validateApiKey(apiKey);
        if (!result.valid || !result.user) {
          return reply.code(401).send({ error: 'Invalid API key' });
        }

        const user = result.user;
        return reply.send({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            isPremium: user.isPremium,
            dailyUsed: user.dailyUsed,
            dailyResetAt: user.dailyResetAt?.toISOString() || null,
          },
        });
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
          isPremium: user.isPremium,
          dailyUsed: user.dailyUsed,
          dailyResetAt: user.dailyResetAt?.toISOString() || null,
        };
      },
    });

    // GET /auth/usage
    fastify.get('/usage', {
      preHandler: [authHook],
      handler: async (request, reply) => {
        const user = request.user;
        const FREE_DAILY_LIMIT = 3;

        return {
          premium: user.isPremium,
          dailyUsed: user.dailyUsed,
          dailyLimit: user.isPremium ? Infinity : FREE_DAILY_LIMIT,
          dailyResetAt: user.dailyResetAt?.toISOString() || null,
          remaining: user.isPremium ? 'unlimited' : Math.max(0, FREE_DAILY_LIMIT - user.dailyUsed),
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

  const apiKey = authHeader.slice(7).trim();
  if (!apiKey) {
    return reply.code(401).send({ error: 'Missing API key' });
  }

  try {
    const { validateApiKey, checkRateLimit } = await import('./prisma.js');
    const result = await validateApiKey(apiKey);

    if (!result.valid) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    const allowed = await checkRateLimit(result.user.id);
    if (!allowed) {
      return reply.code(429).send({ error: 'Daily free limit reached. Upgrade to premium.' });
    }

    request.user = result.user;
    request.apiKey = apiKey;
  } catch (err) {
    request.log.error(err, 'Auth error');
    return reply.code(500).send({ error: 'Authentication service unavailable' });
  }
}
