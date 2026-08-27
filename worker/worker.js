import { Queue, Worker } from 'bullmq';
import redis from 'ioredis';

const connection = redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
});

const queue = new Queue('pdf-tasks', { connection });

// Process jobs from the queue
const worker = new Worker('pdf-tasks', async (job) => {
  console.log(`Processing job ${job.id}: ${job.data.tool}`);

  // Simulating a long-running task
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`Completed job ${job.id}`);
  return { success: true, jobId: job.id };
}, {
  connection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 5000,
  },
});

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

console.log('Worker started, waiting for jobs...');
