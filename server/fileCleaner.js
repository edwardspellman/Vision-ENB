const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FILE_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Ensures the uploads directory exists
 */
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Safely deletes a file from server/uploads given its URL or filename
 * @param {string} fileUrl e.g. "/uploads/photo-123.jpg" or "photo-123.jpg"
 * @returns {boolean} true if deleted, false otherwise
 */
function deleteUploadFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return false;

  try {
    ensureUploadsDir();
    // Use path.basename to prevent directory traversal
    const fileName = path.basename(fileUrl);
    const targetPath = path.join(UPLOADS_DIR, fileName);

    // Verify the resolved path stays within UPLOADS_DIR
    const normalizedTarget = path.normalize(targetPath);
    const normalizedUploads = path.normalize(UPLOADS_DIR);
    if (!normalizedTarget.startsWith(normalizedUploads)) {
      console.warn(`[EPHEMERAL STORAGE] Rejected invalid file deletion path: ${fileUrl}`);
      return false;
    }

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`[EPHEMERAL STORAGE] Deleted upload file: ${fileName}`);
      return true;
    }
  } catch (err) {
    console.error(`[EPHEMERAL STORAGE] Error deleting file ${fileUrl}:`, err.message);
  }
  return false;
}

/**
 * Scans server/uploads directory and deletes any file older than 30 minutes
 * @param {number} [customTtl] optional TTL override in ms (defaults to 30 minutes)
 * @returns {number} count of deleted files
 */
function cleanupExpiredFiles(customTtl = FILE_TTL_MS) {
  ensureUploadsDir();
  let deletedCount = 0;
  const now = Date.now();

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);

      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          // Check file age based on modification time (mtimeMs)
          const fileAge = now - stats.mtimeMs;

          if (fileAge >= customTtl) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[EPHEMERAL STORAGE] Purged 30-min expired upload: ${file} (age: ${Math.round(fileAge / 1000)}s)`);
          }
        }
      } catch (fileErr) {
        console.error(`[EPHEMERAL STORAGE] Error inspecting ${file}:`, fileErr.message);
      }
    }
  } catch (dirErr) {
    console.error('[EPHEMERAL STORAGE] Error reading uploads directory:', dirErr.message);
  }

  return deletedCount;
}

/**
 * Starts periodic background sweeper for 30-minute expired files
 * @param {number} intervalMs scan frequency (default: 30 seconds)
 * @returns {NodeJS.Timeout}
 */
function startFileCleaner(intervalMs = 30 * 1000) {
  ensureUploadsDir();
  // Run an immediate sweep on boot
  cleanupExpiredFiles();

  const interval = setInterval(() => {
    cleanupExpiredFiles();
  }, intervalMs);

  // Allow node process to exit naturally if only this timer is pending
  if (interval.unref) {
    interval.unref();
  }

  return interval;
}

module.exports = {
  UPLOADS_DIR,
  FILE_TTL_MS,
  deleteUploadFile,
  cleanupExpiredFiles,
  startFileCleaner
};
