// main.js - Electron main process with validation
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./utils/encrypt');
const { logInfo, logError } = require('./utils/logger');
const { registerVideoHandlers } = require('./handlers/video-handlers');
const {
  validateSettings,
  validateScheduledPosts,
  validateSavedConfigs,
  validateLibrary,
  validateActivityLog
} = require('./utils/validators');

let schedulerInterval = null;
let mainWindow = null;  // Store window reference globally

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1100,
    minWidth: 800,    // Prevent window from shrinking too narrow (matches CSS min-width)
    minHeight: 600,   // Prevent window from shrinking too short
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Prevent garbage collection
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(() => {
  logInfo('Starting AI Auto Bot...');

  // Register video handlers
  registerVideoHandlers(ipcMain, BrowserWindow);

  // Initialize data directory
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    logInfo('Creating data directory...');
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize empty JSON files if they don't exist
  const defaultFiles = {
    'settings.json': '{}',
    'savedConfigs.json': '{ "configs": [] }',
    'scheduledPosts.json': '{ "posts": [] }',
    'activity_log.json': '{ "logs": [] }',
    'library.json': '{ "items": [] }'
  };

  Object.entries(defaultFiles).forEach(([filename, content]) => {
    const filepath = path.join(dataDir, filename);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, content, 'utf-8');
    }
  });

  createWindow();

  // Start auto-scheduler after window is created
  setTimeout(() => {
    startScheduler();
  }, 5000); // Wait 5 seconds for app to fully initialize
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
// in main.js (requires: const { BrowserWindow, ipcMain } = require('electron'); and fetch available)
ipcMain.handle('start-oauth', async (event, provider) => {
  // Use hardcoded test values for now
  const REDIRECT_URI = 'http://localhost:3000/oauth/callback';
  const PROVIDERS = {
    instagram: {
      authUrl: `https://api.instagram.com/oauth/authorize?client_id=TEST_ID&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=user_profile,user_media`,
      tokenEndpoint: 'https://api.instagram.com/oauth/access_token'
    },
    tiktok: {
      authUrl: `https://open.tiktokapis.com/platform/oauth/connect/?client_key=TEST_KEY&response_type=code&scope=user.info.basic&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
      tokenEndpoint: 'https://open.tiktokapis.com/oauth/access_token/'
    },
    youtube: {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=TEST_ID&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload`,
      tokenEndpoint: 'https://oauth2.googleapis.com/token'
    },
    twitter: {
      authUrl: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=tweet.read%20tweet.write%20users.read`,
      tokenEndpoint: 'https://api.twitter.com/2/oauth2/token'
    }
  };

  const P = PROVIDERS[provider];
  if (!P) throw new Error('Unknown provider');

  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    authWin.loadURL(P.authUrl);

    const handleRedirect = async (event2, url) => {
      try {
        if (!url || !url.startsWith(REDIRECT_URI)) return;
        event2.preventDefault();
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code') || new URLSearchParams(parsed.hash?.slice(1) || '').get('access_token');
        authWin.close();

        if (!code) {
          reject(new Error('No code returned'));
          return;
        }

        // Exchange code for token. Prefer to call your backend for this step.
        const body = new URLSearchParams();
        body.append('client_id', /* CLIENT_ID for provider */);
        body.append('client_secret', /* CLIENT_SECRET or omit if using PKCE/backend */);
        body.append('grant_type', 'authorization_code');
        body.append('redirect_uri', REDIRECT_URI);
        body.append('code', code);

        const tokenResp = await fetch(P.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });

        if (!tokenResp.ok) {
          const txt = await tokenResp.text();
          reject(new Error(`Token exchange failed: ${txt}`));
          return;
        }

        const tokenData = await tokenResp.json();
        const token = tokenData.access_token || tokenData.token;
        // Send token back to renderer
        event.sender.send('oauth-token', { provider, token });
        resolve({ provider, token });
        // Close auth window on success
        authWin.close();
      } catch (err) {
        console.error('OAuth error:', err);
        reject(err);
      }
    };

    // Handle redirects for OAuth flow
    authWin.webContents.on('will-redirect', handleRedirect);
    authWin.webContents.on('will-navigate', handleRedirect);

    // Handle window close
    authWin.on('closed', () => {
      if (!resolved) {
        reject(new Error('OAuth window closed'));
      }
    });
  });
});
// Helper function to get validator for file
function getValidatorForFile(filePath) {
  const filename = path.basename(filePath);

  switch (filename) {
    case 'settings.json':
      return validateSettings;
    case 'scheduledPosts.json':
      return validateScheduledPosts;
    case 'savedConfigs.json':
      return validateSavedConfigs;
    case 'library.json':
      return validateLibrary;
    case 'activity_log.json':
      return validateActivityLog;
    default:
      return null;
  }
}

// IPC handler: read a file
ipcMain.handle('READ_FILE', async (_evt, filePath) => {
  console.log('[IPC] READ_FILE:', filePath);
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: write a file WITH VALIDATION
ipcMain.handle('WRITE_FILE', async (_evt, { filePath, content }) => {
  console.log('[IPC] WRITE_FILE:', filePath);
  try {
    const validator = getValidatorForFile(filePath);

    if (validator) {
      let data;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        return {
          success: false,
          error: {
            message: 'Invalid JSON format',
            details: parseError.message
          }
        };
      }

      const { valid, errors } = validator(data);
      if (!valid) {
        return {
          success: false,
          error: {
            message: 'Validation failed',
            details: errors
          }
        };
      }
    }

    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: encrypt data
ipcMain.handle('ENCRYPT_DATA', async (_evt, plaintext) => {
  try {
    const encrypted = encrypt(plaintext);
    return { success: true, data: encrypted };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: decrypt data
ipcMain.handle('DECRYPT_DATA', async (_evt, ciphertext) => {
  try {
    const decrypted = decrypt(ciphertext);
    return { success: true, data: decrypted };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// Auto-Scheduler Function
function startScheduler() {
  schedulerInterval = setInterval(async () => {
    try {
      const scheduledPostsPath = path.join(__dirname, 'data', 'scheduledPosts.json');

      if (!fs.existsSync(scheduledPostsPath)) return;

      const content = await fs.promises.readFile(scheduledPostsPath, 'utf-8');
      const data = JSON.parse(content);
      const posts = data.posts || [];

      const now = new Date();
      const postsToExecute = posts.filter(post => {
        if (post.posted) return false;

        const scheduledTime = new Date(post.scheduledTime);
        return scheduledTime <= now;
      });

      for (const post of postsToExecute) {
        console.log(`[Scheduler] Executing scheduled post: ${post.scheduledTime}`);

        // Mark as posted
        post.posted = true;
        post.postedAt = new Date().toISOString();

        // Send to renderer to execute
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send('EXECUTE_SCHEDULED_POST', post);
        }
      }

      // Save updated posts
      if (postsToExecute.length > 0) {
        await fs.promises.writeFile(
          scheduledPostsPath,
          JSON.stringify(data, null, 2),
          'utf-8'
        );
      }
    } catch (error) {
      console.error('[Scheduler] Error:', error.message);
    }
  }, 60000); // Check every minute

  console.log('[Scheduler] Started - checking every 60 seconds');
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

app.on('before-quit', () => {
  stopScheduler();
});
