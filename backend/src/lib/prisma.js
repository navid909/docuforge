const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

export const prisma = new PrismaClient();

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function getKeyPrefix(key) {
  return key.slice(0, 12);
}

export async function createUserWithApiKey(email, password, name) {
  const passwordHash = password ? await hashPassword(password) : null;
  const apiKey = `d4g_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = getKeyPrefix(apiKey);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      apiKeys: {
        create: {
          keyHash,
          keyPrefix,
          name: name || 'default',
        },
      },
    },
    include: {
      apiKeys: true,
    },
  });

  return { user, apiKey };
}

export async function validateApiKey(key) {
  const keyHash = hashApiKey(key);
  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKeyRecord) {
    return { valid: false, user: null };
  }

  await prisma.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsed: new Date() },
  });

  return { valid: true, user: apiKeyRecord.user };
}

export async function getUserById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { apiKeys: true },
  });
}

export async function incrementDailyUsage(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const now = new Date();
  const resetAt = user.dailyResetAt;
  const shouldReset = now > resetAt || (resetAt.getTime() - now.getTime()) > 24 * 60 * 60 * 1000;

  if (shouldReset) {
    return prisma.user.update({
      where: { id: userId },
      data: { dailyUsed: 1, dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
  }

  return prisma.user.update({
    where: { id: userId },
    data: { dailyUsed: { increment: 1 } },
  });
}

export async function checkRateLimit(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isPremium) return true;

  const now = new Date();
  const resetAt = user.dailyResetAt;
  const shouldReset = now >= resetAt;

  if (shouldReset) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyUsed: 0, dailyResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    return true;
  }

  return user.dailyUsed < 3; // FREE_DAILY_LIMIT
}

export async function createConversionJob(userId, tool, inputFile, outputFile, outputFiles) {
  return prisma.conversionJob.create({
    data: {
      userId,
      tool,
      inputFile,
      outputFile,
      outputFiles,
      status: 'pending',
    },
  });
}

export async function updateJobStatus(jobId, status, outputFile, outputFiles, error) {
  return prisma.conversionJob.update({
    where: { id: jobId },
    data: {
      status,
      outputFile,
      outputFiles,
      error,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : null,
    },
  });
}

export async function getUserJobs(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [jobs, total] = await Promise.all([
    prisma.conversionJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.conversionJob.count({ where: { userId } }),
  ]);
  return { jobs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createSubscription(userId, sessionId, customerId, plan, periodEnd) {
  return prisma.subscription.create({
    data: {
      userId,
      stripeSessionId: sessionId,
      stripeCustomerId: customerId,
      status: 'active',
      plan: plan || 'premium',
      currentPeriodEnd: periodEnd,
    },
  });
}

export async function updateSubscription(sessionId, data) {
  return prisma.subscription.update({
    where: { stripeSessionId: sessionId },
    data,
  });
}

export async function getUserSubscription(userId) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: 'active',
      currentPeriodEnd: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function activatePremium(userId, days = 30) {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return prisma.user.update({
    where: { id: userId },
    data: { isPremium: true, premiumUntil: until },
  });
}
