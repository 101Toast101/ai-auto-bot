const fs = require('fs');
const path = require('path');

// Determine if running in production (packaged app)
// In development: NODE_ENV=development OR process.defaultApp === true
// In production: NODE_ENV=production OR process.defaultApp === false (packaged)
// In tests: process.defaultApp is undefined, treat as development
const isProd = process.env.NODE_ENV === 'production' || (typeof process.defaultApp !== 'undefined' && !process.defaultApp);

// Log file paths
const logsDir = path.join(__dirname, '..', 'logs');
const infoLogPath = path.join(logsDir, 'app.log');
const errorLogPath = path.join(logsDir, 'error.log');

// Ensure logs directory exists
function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (err) {
      // Fallback to console if can't create logs directory
      console.error('Failed to create logs directory:', err);
    }
  }
}

// Write log to file with rotation
function writeToFile(filePath, message) {
  try {
    ensureLogsDir();
    
    // Check file size and rotate if > 5MB
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 5 * 1024 * 1024) {
        const backupPath = filePath.replace('.log', `.${Date.now()}.log`);
        fs.renameSync(filePath, backupPath);
        
        // Keep only last 5 rotated logs
        const logFiles = fs.readdirSync(logsDir)
          .filter(f => f.startsWith(path.basename(filePath, '.log')) && f.endsWith('.log'))
          .sort()
          .reverse();
        
        if (logFiles.length > 5) {
          logFiles.slice(5).forEach(f => {
            try {
              fs.unlinkSync(path.join(logsDir, f));
            } catch (e) {
              // Ignore deletion errors
            }
          });
        }
      }
    }
    
    fs.appendFileSync(filePath, message + '\n', 'utf8');
  } catch (err) {
    // Fallback to console if file write fails
    console.error('Failed to write to log file:', err);
  }
}

function logInfo(msg) {
  const timestamp = new Date().toISOString();
  const logMessage = `[INFO] ${timestamp} — ${msg}`;
  
  if (isProd) {
    writeToFile(infoLogPath, logMessage);
  } else {
    console.warn(logMessage);
  }
}

function logError(msg, err) {
  const timestamp = new Date().toISOString();
  const errorDetails = err ? `\n${err.stack || err.message || err}` : '';
  const logMessage = `[ERROR] ${timestamp} — ${msg}${errorDetails}`;
  
  if (isProd) {
    writeToFile(errorLogPath, logMessage);
  } else {
    console.error(logMessage, err || '');
  }
}

function logWarn(msg) {
  const timestamp = new Date().toISOString();
  const logMessage = `[WARN] ${timestamp} — ${msg}`;
  
  if (isProd) {
    writeToFile(infoLogPath, logMessage);
  } else {
    console.warn(logMessage);
  }
}

function logSecurity(msg) {
  const timestamp = new Date().toISOString();
  const logMessage = `[SECURITY] ${timestamp} — ${msg}`;
  
  // Always log security events to file, even in dev
  writeToFile(errorLogPath, logMessage);
  
  if (!isProd) {
    console.error(logMessage);
  }
}

module.exports = { logInfo, logError, logWarn, logSecurity };
