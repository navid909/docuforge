export async function authHook(request, reply) {
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

export function requirePremium(request, reply) {
  if (!request.user?.isPremium) {
    return reply.code(403).send({ error: 'Premium subscription required' });
  }
}
