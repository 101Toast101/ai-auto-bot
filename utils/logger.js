// utils/logger.js
function logInfo(msg) {
  console.warn(`[INFO] ${new Date().toISOString()} — ${msg}`);
}

function logError(msg, err) {
  console.error(`[ERROR] ${new Date().toISOString()} — ${msg}`, err);
}

module.exports = { logInfo, logError };
