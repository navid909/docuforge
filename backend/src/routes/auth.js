import { FastifyPluginAsyncTypebox } from '@fastify/typebox';
import { Type } from '@fastify/typebox';

export const authRoutes = FastifyPluginAsyncTypebox({
  async fastify({ reply, log }) {
    const prisma = await import('../lib/prisma.js');

    // POST /auth/signup
    fastify.post('/signup', {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email' }),
          password: Type.Optional(Type.String({ minLength: 8 })),
          name: Type.Optional(Type.String()),
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
          400: Type.Object({
            error: Type.String(),
          }),
          409: Type.Object({
            error: Type.String(),
          }),
        },
      },
      handler: async (request, reply) => {
        const { email, password, name } = request.body;

        try {
          const existing = await prisma.prisma.user.findUnique({
            where: { email },
          });

          if (existing) {
            return reply.code(409).send({ error: 'User with this email already exists' });
          }

          const { user, apiKey } = await prisma.createUserWithApiKey(email, password, name);

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

    // POST /auth/login (password-based)
    fastify.post('/login', {
      schema: {
        body: Type.Object({
          email: Type.String({ format: 'email' }),
          password: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
            }),
            apiKey: Type.String(),
          }),
          401: Type.Object({
            error: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
          }),
        },
      },
      handler: async (request, reply) => {
        const { email, password } = request.body;

        try {
          const user = await prisma.prisma.user.findUnique({
            where: { email },
            include: { apiKeys: true },
          });

          if (!user) {
            return reply.code(404).send({ error: 'User not found' });
          }

          if (!user.passwordHash) {
            return reply.code(401).send({ error: 'Password authentication not set up for this account' });
          }

          const isValid = await prisma.verifyPassword(password, user.passwordHash);
          if (!isValid) {
            return reply.code(401).send({ error: 'Invalid password' });
          }

          const apiKey = user.apiKeys[0]?.keyHash
            ? await import('crypto').then(crypto =>
                'd4g_' + crypto.randomBytes(32).toString('hex')
              )
            : null;

          if (apiKey) {
            const keyHash = await import('../lib/prisma.js').then(m => m.hashApiKey(apiKey));
            const keyPrefix = apiKey.slice(0, 12);
            await prisma.prisma.apiKey.create({
              data: {
                keyHash,
                keyPrefix,
                name: 'main',
                userId: user.id,
              },
            });
          }

          const activeKey = user.apiKeys[0]?.keyHash || apiKey;

          return reply.send({
            success: true,
            user: { id: user.id, email: user.email },
            apiKey: activeKey,
          });
        } catch (error) {
          log.error(error);
          return reply.code(400).send({ error: 'Login failed' });
        }
      },
    });

    // POST /auth/api-key (exchange API key for session)
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
          401: Type.Object({
            error: Type.String(),
          }),
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
  const prisma = await import('../lib/prisma.js');
  const result = await prisma.validateApiKey(apiKey);

  if (!result.valid || !result.user) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }

  request.user = result.user;
  request.apiKey = apiKey;
}
