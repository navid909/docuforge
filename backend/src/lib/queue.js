import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD || undefined;

export const connection = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
});

export const conversionQueue = new Queue('conversion-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 50,
      age: 7 * 24 * 3600,
    },
  },
});

export async function addConversionJob(data) {
  return conversionQueue.add(data.tool, data, {
    jobId: data.jobId,
  });
}

export async function getJobStatus(jobId) {
  const job = await conversionQueue.getJob(jobId);
  if (!job) return null;
  return {
    id: job.id,
    status: await job.getState(),
    progress: job.progress,
    data: job.data,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

export async function closeQueue() {
  await conversionQueue.close();
  await connection.quit();
}
