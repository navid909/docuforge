import { Worker } from 'bullmq';
import { connection, conversionQueue } from '../lib/queue.js';
import * as tools from '../tools/index.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', '..', 'tmp');

async function ensureTmpDir() {
  await fs.ensureDir(TMP_DIR);
}

async function cleanupFile(filePath) {
  try {
    await fs.remove(filePath);
  } catch (err) {
    console.error('Failed to cleanup file:', filePath, err);
  }
}

async function processJob(job) {
  const { tool, inputFile, jobId } = job.data;
  const ext = path.extname(inputFile);
  const outputDir = path.join(TMP_DIR, jobId);
  await fs.ensureDir(outputDir);

  const outputFile = path.join(outputDir, `output_${Date.now()}${getOutputExt(tool)}`);

  try {
    let result;
    switch (tool) {
      case 'pdf-to-word':
        result = await tools.pdfToWord(inputFile, outputFile);
        break;
      case 'pdf-to-excel':
        result = await tools.pdfToExcel(inputFile, outputFile);
        break;
      case 'pdf-to-ppt':
        result = await tools.pdfToPpt(inputFile, outputFile);
        break;
      case 'pdf-to-images':
        result = await tools.pdfToImages(inputFile, outputDir);
        break;
      case 'image-to-pdf':
        result = await tools.imageToPdf(inputFile, outputFile);
        break;
      case 'docx-to-pdf':
        result = await tools.docxToPdf(inputFile, outputFile);
        break;
      case 'xlsx-to-pdf':
        result = await tools.xlsxToPdf(inputFile, outputFile);
        break;
      case 'pptx-to-pdf':
        result = await tools.pptxToPdf(inputFile, outputFile);
        break;
      case 'merge-pdfs':
        const inputFiles = JSON.parse(job.data.inputFiles || '[]');
        result = await tools.mergePdfs(inputFiles, outputFile);
        break;
      case 'compress-pdf':
        result = await tools.compressPdf(inputFile, outputFile);
        break;
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    return { success: true, outputFile, outputFiles: result?.outputFiles || null };
  } catch (error) {
    await fs.remove(outputDir).catch(() => {});
    throw error;
  }
}

function getOutputExt(tool) {
  const map = {
    'pdf-to-word': '.docx',
    'pdf-to-excel': '.xlsx',
    'pdf-to-ppt': '.pptx',
    'pdf-to-images': '',
    'image-to-pdf': '.pdf',
    'docx-to-pdf': '.pdf',
    'xlsx-to-pdf': '.pdf',
    'pptx-to-pdf': '.pdf',
    'merge-pdfs': '.pdf',
    'compress-pdf': '.pdf',
  };
  return map[tool] || '.bin';
}

async function main() {
  await ensureTmpDir();

  const worker = new Worker('conversion-jobs', async (job) => {
    return processJob(job);
  }, {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
    limiter: {
      maxDelay: 5000,
      delay: 1000,
    },
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log('Worker started, listening for conversion jobs...');

  process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    await conversionQueue.close();
    await connection.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
