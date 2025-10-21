// main.js - Electron main process with validation
require('dotenv').config(); // Load environment variables
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

// Initialize Express server for OAuth callbacks
const express = require('express');
const oauthApp = express();
const PORT = 3000;

let schedulerInterval = null;
let mainWindow = null;  // Store window reference globally
let oauthServer = null;  // Store server reference

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

  // Start OAuth callback server
  startOAuthServer();

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

// Start OAuth callback server
function startOAuthServer() {
  if (oauthServer) {
    logInfo('OAuth server already running');
    return;
  }

  // Handle OAuth callback
  oauthApp.get('/oauth/callback', async (req, res) => {
    try {
      const code = req.query.code;
      if (!code) {
        res.send('<h1>Error: No authorization code received</h1>');
        return;
      }

      // Send success page - the BrowserWindow will handle the code
      res.send(`
        <html>
          <head><title>OAuth Success</title></head>
          <body>
            <h1>✅ Authorization successful!</h1>
            <p>You can close this window and return to the app.</p>
            <script>
              // Close window after 2 seconds
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      logError('OAuth callback error:', err);
      res.status(500).send(`<h1>Error: ${err.message}</h1>`);
    }
  });

  oauthServer = oauthApp.listen(PORT, () => {
    logInfo(`OAuth callback server running on http://localhost:${PORT}`);
  });

  oauthServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logError(`Port ${PORT} is already in use. OAuth callbacks may not work.`);
    } else {
      logError('OAuth server error:', err);
    }
  });
}

// Stop OAuth server on quit
app.on('before-quit', () => {
  if (oauthServer) {
    oauthServer.close();
    logInfo('OAuth server stopped');
  }
});

// OAuth Handler - Uses real credentials from .env
ipcMain.handle('start-oauth', async (event, provider) => {
  const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/oauth/callback';

  // Generate PKCE values for TikTok
  let codeVerifier, codeChallenge;
  if (provider === 'tiktok') {
    codeVerifier = crypto.randomBytes(32).toString('base64url');
    codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  const PROVIDERS = {
    instagram: {
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
      authUrl: `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=user_profile,user_media`,
      tokenEndpoint: 'https://api.instagram.com/oauth/access_token'
    },
    tiktok: {
      clientId: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      authUrl: `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&response_type=code&scope=user.info.basic,video.upload&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_challenge=${codeChallenge}&code_challenge_method=S256`,
      tokenEndpoint: 'https://open-api.tiktok.com/oauth/access_token/',
      codeVerifier: codeVerifier
    },
    youtube: {
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload`,
      tokenEndpoint: 'https://oauth2.googleapis.com/token'
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      authUrl: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=tweet.read%20tweet.write%20users.read`,
      tokenEndpoint: 'https://api.twitter.com/2/oauth2/token'
    }
  };

  const P = PROVIDERS[provider];
  if (!P) throw new Error('Unknown provider');

  // Debug logging
  console.log(`[OAuth Debug] Provider: ${provider}`);
  console.log(`[OAuth Debug] Client ID: ${P.clientId}`);
  console.log(`[OAuth Debug] Auth URL: ${P.authUrl}`);

  // Check if credentials are configured
  if (!P.clientId || !P.clientSecret || P.clientId.startsWith('YOUR_') || P.clientId.includes('test')) {
    throw new Error(`${provider} credentials not configured. Please update your .env file with real OAuth credentials.`);
  }

  let resolved = false; // Track if promise has been resolved

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
        if (resolved) return; // Already handled

        event2.preventDefault();
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code') || new URLSearchParams(parsed.hash?.slice(1) || '').get('access_token');

        if (!code) {
          resolved = true;
          authWin.close();
          reject(new Error('No authorization code returned'));
          return;
        }

        // Exchange code for token
        const body = new URLSearchParams();
        body.append('client_id', P.clientId);
        body.append('client_secret', P.clientSecret);
        body.append('grant_type', 'authorization_code');
        body.append('redirect_uri', REDIRECT_URI);
        body.append('code', code);

        // Add code_verifier for TikTok PKCE
        if (provider === 'tiktok' && P.codeVerifier) {
          body.append('code_verifier', P.codeVerifier);
        }

        const tokenResp = await fetch(P.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });

        if (!tokenResp.ok) {
          const txt = await tokenResp.text();
          resolved = true;
          authWin.close();
          reject(new Error(`Token exchange failed: ${txt}`));
          return;
        }

        const tokenData = await tokenResp.json();
        const token = tokenData.access_token || tokenData.token;

        if (!token) {
          resolved = true;
          authWin.close();
          reject(new Error('No access token in response'));
          return;
        }

        // Send token back to renderer
        event.sender.send('oauth-token', { provider, token });

        resolved = true;
        authWin.close();
        resolve({ provider, token });
      } catch (err) {
        console.error('OAuth error:', err);
        if (!resolved) {
          resolved = true;
          authWin.close();
          reject(err);
        }
      }
    };

    // Handle redirects for OAuth flow
    authWin.webContents.on('will-redirect', handleRedirect);
    authWin.webContents.on('will-navigate', handleRedirect);

    // Handle window close
    authWin.on('closed', () => {
      if (!resolved) {
        resolved = true;
        reject(new Error('OAuth window closed by user'));
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
