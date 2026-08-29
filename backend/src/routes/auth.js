import crypto from 'crypto';

export default async function authRoutes(fastify, options) {
  const { prisma, hashApiKey, revealApiKey } = await import('../lib/prisma.js');

  fastify.post('/register', async (request, reply) => {
    const { email } = request.body || {};

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.code(409).send({ error: 'User with this email already exists' });
      }

      const token = 'd4g_' + crypto.randomBytes(32).toString('hex');
      const keyHash = hashApiKey(token);
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
      fastify.log.error({ error: error.message, stack: error.stack, code: error.code }, 'Register failed');
      return reply.code(400).send({ error: 'Failed to create user', details: error.message });
    }
  });

  fastify.post('/login', async (request, reply) => {
    const { email } = request.body || {};

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { apiKeys: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      let token = user.apiKeys[0]?.keyPrefix
        ? revealApiKey(user.apiKeys[0].keyPrefix, user.apiKeys[0].keyHash)
        : null;

      if (!token) {
        token = 'd4g_' + crypto.randomBytes(32).toString('hex');
        const keyHash = hashApiKey(token);
        const keyPrefix = token.slice(0, 12);
        await prisma.apiKey.create({ data: { keyHash, keyPrefix, name: 'main', userId: user.id } });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        token,
        premium: user.isPremium || false,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(400).send({ error: 'Login failed' });
    }
  });

  fastify.get('/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return reply.code(401).send({ error: 'Missing token' });
    }

    try {
      const { validateApiKey, checkRateLimit } = await import('../lib/prisma.js');
      const result = await validateApiKey(token);

      if (!result.valid) {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      const allowed = await checkRateLimit(result.user.id);
      if (!allowed) {
        return reply.code(429).send({ error: 'Daily free limit reached. Upgrade to premium.' });
      }

      const user = result.user;
      return {
        id: user.id,
        email: user.email,
        premium: user.isPremium,
      };
    } catch (err) {
      fastify.log.error(err, 'Auth error');
      return reply.code(500).send({ error: 'Authentication service unavailable' });
    }
  });
}
