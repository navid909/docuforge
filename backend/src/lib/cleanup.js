const fs = require('fs/promises');
const path = require('path');

/**
 * Configuration for tmp file cleanup
 * @type {{ tmpDir: string, maxAge?: number, maxSize?: number, maxFiles?: number }}
 */
const defaultConfig = {
  tmpDir: path.join(__dirname, '..', '..', 'tmp'),
  maxAge: 3600, // 1 hour in seconds
  maxSize: 500 * 1024 * 1024, // 500 MB
  maxFiles: 1000,
};

async function cleanupOldFiles(config) {
  const { tmpDir, maxAge = 3600, maxSize = 500 * 1024 * 1024, maxFiles = 1000 } = config;

  await fs.mkdir(tmpDir, { recursive: true });

  // Get all files with stats
  const files = await fs.readdir(tmpDir);
  const fileStats = [];

  for (const file of files) {
    const filePath = path.join(tmpDir, file);
    try {
      const stat = await fs.stat(filePath);
      fileStats.push({ filePath, stat, file });
    } catch (e) {
      // skip
    }
  }

  // Sort by modification time (oldest first)
  fileStats.sort((a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime());

  // Remove old files
  const now = new Date();
  const cutoff = new Date(now.getTime() - maxAge * 1000);

  for (const { filePath, stat } of fileStats) {
    if (stat.mtime > cutoff) break;

    try {
      await fs.rm(filePath, { recursive: true, force: true });
      console.log('Cleaned up:', filePath);
    } catch (e) {
      console.error('Failed to remove:', filePath, e);
    }
  }

  // If still over size limit, remove oldest files
  const remainingFiles = await fs.readdir(tmpDir);
  const remainingStats = [];
  for (const file of remainingFiles) {
    const filePath = path.join(tmpDir, file);
    try {
      const stat = await fs.stat(filePath);
      remainingStats.push({ filePath, stat, file });
    } catch (e) {}
  }
  remainingStats.sort((a, b) => a.stat.mtime.getTime() - b.stat.mtime.getTime());

  const currentSize = remainingStats.reduce((sum, f) => sum + f.stat.size, 0);

  while (currentSize > maxSize && remainingStats.length > 100) {
    const oldest = remainingStats.shift();
    try {
      await fs.rm(oldest.filePath, { recursive: true, force: true });
      console.log('Removed (size):', oldest.filePath);
      currentSize -= oldest.stat.size;
    } catch (e) {
      console.error('Failed to remove (size):', oldest.filePath, e);
    }
  }

  // Remove excess files
  while (remainingStats.length > maxFiles) {
    const oldest = remainingStats.shift();
    try {
      await fs.rm(oldest.filePath, { recursive: true, force: true });
      console.log('Removed (count):', oldest.filePath);
    } catch (e) {
      console.error('Failed to remove (count):', oldest.filePath, e);
    }
  }

  return {
    removed: fileStats.length,
    remaining: remainingFiles.length,
    totalSize: currentSize,
  };
}

function scheduleCleanup(intervalMs = 3600000) {
  const config = defaultConfig;

  // Run immediately on startup
  cleanupOldFiles(config).catch((e) => {
    console.error('Initial cleanup failed:', e);
  });

  const interval = setInterval(async () => {
    try {
      await cleanupOldFiles(config);
    } catch (e) {
      console.error('Scheduled cleanup failed:', e);
    }
  }, intervalMs);

  return interval;
}

module.exports = { cleanupOldFiles, scheduleCleanup, defaultConfig };
