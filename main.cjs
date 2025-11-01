require("dotenv").config(); // Load environment variables
const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { encrypt, decrypt } = require("./utils/encrypt.cjs");
const { logInfo, logError } = require("./utils/logger.cjs");
const { registerVideoHandlers } = require("./handlers/video-handlers.cjs");
const { IPC_CHANNELS } = require("./utils/ipc-constants.cjs");
const {
  validateSettings,
  validateScheduledPosts,
  validateSavedConfigs,
  validateLibrary,
  validateActivityLog,
} = require("./utils/validators.cjs");

// Initialize Express server for OAuth callbacks
const express = require("express");
const oauthApp = express();
const PORT = 3000;

const tokenStore = require("./tokenStore.cjs");

function loadSavedProviderConfig(provider) {
  try {
    const cfgPath = path.join(__dirname, "data", "settings.json");
    if (!fs.existsSync(cfgPath)) {return null;}
    const raw = fs.readFileSync(cfgPath, "utf8");
    const settings = JSON.parse(raw || "{}");
    const prov = settings.providers && settings.providers[provider];
    if (!prov) {return null;}
    return {
      clientId: prov.clientId || null,
      clientSecret: prov.clientSecret ? decrypt(prov.clientSecret) : null,
      redirectUri: prov.redirectUri || null,
    };
  } catch (err) {
    logError("Failed to read saved provider config:", err);
    return null;
  }
}

let schedulerInterval = null;
let mainWindow = null; // Store window reference globally
let oauthServer = null; // Store server reference

// Helper to safely send IPC messages from main to renderer. Replaces undefined with null
function safeSend(win, channel, payload) {
  try {
    if (!win || win.isDestroyed()) {return;}
    // Ensure payload is defined; Electron's IPC can fail when arguments contain `undefined`.
    const safePayload = payload === undefined ? null : payload;
    win.webContents.send(channel, safePayload);
  } catch (e) {
    logError(`safeSend failed for channel ${channel}:`, e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1100,
    minWidth: 800, // Prevent window from shrinking too narrow (matches CSS min-width)
    minHeight: 600, // Prevent window from shrinking too short
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Zoom controls - Ctrl+Plus, Ctrl+Minus, Ctrl+0
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control || input.meta) {
      const currentZoom = mainWindow.webContents.getZoomLevel();

      // Zoom In: Ctrl+Plus or Ctrl+=
      if (input.key === "+" || input.key === "=") {
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
        event.preventDefault();
      }
      // Zoom Out: Ctrl+Minus
      else if (input.key === "-" || input.key === "_") {
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
        event.preventDefault();
      }
      // Reset Zoom: Ctrl+0
      else if (input.key === "0") {
        mainWindow.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  });

  // Create menu with View > Zoom options
  const menuTemplate = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.webContents.reload();
          },
        },
        { type: "separator" },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
          },
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
          },
        },
        {
          label: "Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            mainWindow.webContents.setZoomLevel(0);
          },
        },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Prevent garbage collection
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Global error handlers: log, persist, and show a clear dialog to the user
process.on("uncaughtException", async (err) => {
  try {
    const msg = `Uncaught Exception: ${err.message}`;
    logError(msg, err.stack || err);
    // persist a single-line marker to activity_log.json
    try {
      const logPath = path.join(__dirname, "data", "activity_log.json");
      let existing = [];
      if (fs.existsSync(logPath)) {
        existing = JSON.parse(fs.readFileSync(logPath, "utf8") || "[]");
      }
      existing.unshift({
        ts: new Date().toISOString(),
        level: "error",
        message: msg,
        details: (err && err.stack) || String(err),
      });
      fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
    } catch {
      // ignore persistence failures
    }

    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("APP_ERROR", { message: err.message, stack: err.stack });
      }
    } catch {
      // ignore
    }

    // Show blocking error dialog so the user notices the problem
    try {
      dialog.showErrorBox("Application error", `${err.message}\n\nSee activity log in the app for details.`);
    } catch {
      console.error("Failed to show error dialog");
    }
  } finally {
    // Don't exit automatically — let the app attempt to continue. If you prefer exiting, uncomment below.
    // process.exit(1);
  }
});

process.on("unhandledRejection", async (reason) => {
  try {
    const msg = `Unhandled Rejection: ${reason && reason.message ? reason.message : String(reason)}`;
    logError(msg, reason && reason.stack ? reason.stack : reason);
    try {
      const logPath = path.join(__dirname, "data", "activity_log.json");
      let existing = [];
      if (fs.existsSync(logPath)) {
        existing = JSON.parse(fs.readFileSync(logPath, "utf8") || "[]");
      }
      existing.unshift({
        ts: new Date().toISOString(),
        level: "error",
        message: msg,
        details: reason && reason.stack ? reason.stack : String(reason),
      });
      fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
    } catch {
      // ignore
    }
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("APP_ERROR", { message: msg, stack: reason && reason.stack });
      }
    } catch {
      // ignore
    }
    try { dialog.showErrorBox("Unhandled promise rejection", msg); } catch {
      // ignore
    }
  } catch {
    // ignore
  }
});

app.whenReady().then(() => {
  logInfo("Starting AI Auto Bot...");

  // Register video handlers
  registerVideoHandlers(ipcMain, BrowserWindow);

  // Initialize data directory
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    logInfo("Creating data directory...");
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize empty JSON files if they don't exist
  const defaultFiles = {
    "settings.json": "{}",
    "savedConfigs.json": '{ "configs": [] }',
    "scheduledPosts.json": '{ "posts": [] }',
    "activity_log.json": '{ "logs": [] }',
    "library.json": '{ "items": [] }',
  };

  Object.entries(defaultFiles).forEach(([filename, content]) => {
    const filepath = path.join(dataDir, filename);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, content, "utf-8");
    }
  });

  createWindow();

  // Diagnostics removed; IPC bridge validated during prior debug session.

  // Start OAuth callback server
  startOAuthServer();

  // Start auto-scheduler after window is created
  setTimeout(() => {
    startScheduler();
  }, 5000); // Wait 5 seconds for app to fully initialize
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Store pending OAuth requests (for system browser flow)
const pendingOAuthRequests = new Map();

// Start OAuth callback server
function startOAuthServer() {
  if (oauthServer) {
    logInfo("OAuth server already running");
    return;
  }

  // Handle OAuth callback
  oauthApp.get("/oauth/callback", async (req, res) => {
    try {
      const code = req.query.code;
      const state = req.query.state;

      if (!code) {
        res.send("<h1>Error: No authorization code received</h1>");
        return;
      }

      // Check if this is a Twitter callback (has state parameter and pending request)
      let twitterRequest = null;
      for (const [provider, data] of pendingOAuthRequests.entries()) {
        if (provider === "twitter" && data.state === state) {
          twitterRequest = data;
          break;
        }
      }

      if (twitterRequest) {
        // Handle Twitter token exchange
        try {
          const body = new URLSearchParams();
          body.append("client_id", twitterRequest.clientId);
          body.append("grant_type", "authorization_code");
          body.append(
            "redirect_uri",
            process.env.REDIRECT_URI || "http://localhost:3000/oauth/callback",
          );
          body.append("code", code);
          body.append("code_verifier", twitterRequest.codeVerifier);

          const tokenResp = await fetch(
            "https://api.twitter.com/2/oauth2/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(`${twitterRequest.clientId}:${twitterRequest.clientSecret}`).toString("base64")}`,
              },
              body: body.toString(),
            },
          );

          if (!tokenResp.ok) {
            const errorText = await tokenResp.text();
            throw new Error(`Token exchange failed: ${errorText}`);
          }

          const tokenData = await tokenResp.json();
          const token = tokenData.access_token;

          if (!token) {
            throw new Error("No access token in response");
          }

          // Persist token securely
          try {
            tokenStore.saveToken("twitter", token, tokenData.expires_in || null);
          } catch (e) {
            logError("Failed to persist twitter token:", e);
          }

          // Send token to renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              safeSend(mainWindow, "oauth-token", {
                provider: "twitter",
                token: token || null,
              });
            }

          pendingOAuthRequests.delete("twitter");

          res.send(`
						<html>
							<head><title>Twitter Connected!</title></head>
							<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
								<h1 style="color: #1DA1F2;">✅ Twitter Connected!</h1>
								<p>You can close this window and return to the app.</p>
								<script>
									setTimeout(() => window.close(), 2000);
								</script>
							</body>
						</html>
					`);
        } catch (tokenError) {
          logError("Twitter token exchange error:", tokenError);
          res.status(500).send(`<h1>Error: ${tokenError.message}</h1>`);
        }
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
      logError("OAuth callback error:", err);
      res.status(500).send(`<h1>Error: ${err.message}</h1>`);
    }
  });

  oauthServer = oauthApp.listen(PORT, () => {
    logInfo(`OAuth callback server running on http://localhost:${PORT}`);
  });

  oauthServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logError(`Port ${PORT} is already in use. OAuth callbacks may not work.`);
    } else {
      logError("OAuth server error:", err);
    }
  });
}

// Stop OAuth server on quit
app.on("before-quit", () => {
  if (oauthServer) {
    oauthServer.close();
    logInfo("OAuth server stopped");
  }
});

// OAuth Handler - Uses real credentials from .env
ipcMain.handle("start-oauth", async (event, provider) => {
  const REDIRECT_URI =
    process.env.REDIRECT_URI || "http://localhost:3000/oauth/callback";

  // Generate PKCE values for TikTok and Twitter
  let codeVerifier, codeChallenge, state;
  if (provider === "tiktok" || provider === "twitter") {
    codeVerifier = crypto.randomBytes(32).toString("base64url");
    codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    state = crypto.randomBytes(16).toString("hex");
  }

  // Prefer saved provider config in settings.json (decrypted) over environment variables
  const savedInstagram = loadSavedProviderConfig("instagram") || {};
  const savedTikTok = loadSavedProviderConfig("tiktok") || {};
  const savedYouTube = loadSavedProviderConfig("youtube") || {};
  const savedTwitter = loadSavedProviderConfig("twitter") || {};

  const PROVIDERS = {
    instagram: {
      clientId: savedInstagram.clientId || process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: savedInstagram.clientSecret || process.env.INSTAGRAM_CLIENT_SECRET,
      authUrl: `https://api.instagram.com/oauth/authorize?client_id=${savedInstagram.clientId || process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(savedInstagram.redirectUri || REDIRECT_URI)}&response_type=code&scope=user_profile,user_media`,
      tokenEndpoint: "https://api.instagram.com/oauth/access_token",
    },
    tiktok: {
      clientId: savedTikTok.clientId || process.env.TIKTOK_CLIENT_KEY,
      clientSecret: savedTikTok.clientSecret || process.env.TIKTOK_CLIENT_SECRET,
      authUrl: `https://www.tiktok.com/v2/auth/authorize/?client_key=${savedTikTok.clientId || process.env.TIKTOK_CLIENT_KEY}&response_type=code&scope=user.info.basic,video.upload&redirect_uri=${encodeURIComponent(savedTikTok.redirectUri || REDIRECT_URI)}&code_challenge=${codeChallenge}&code_challenge_method=S256`,
      tokenEndpoint: "https://open-api.tiktok.com/oauth/access_token/",
      codeVerifier: codeVerifier,
    },
    youtube: {
      clientId: savedYouTube.clientId || process.env.YOUTUBE_CLIENT_ID,
      clientSecret: savedYouTube.clientSecret || process.env.YOUTUBE_CLIENT_SECRET,
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${savedYouTube.clientId || process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(savedYouTube.redirectUri || REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/youtube.upload`,
      tokenEndpoint: "https://oauth2.googleapis.com/token",
    },
    twitter: {
      clientId: savedTwitter.clientId || process.env.TWITTER_CLIENT_ID,
      clientSecret: savedTwitter.clientSecret || process.env.TWITTER_CLIENT_SECRET,
      authUrl: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${savedTwitter.clientId || process.env.TWITTER_CLIENT_ID}&redirect_uri=${encodeURIComponent(savedTwitter.redirectUri || REDIRECT_URI)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`,
      tokenEndpoint: "https://api.twitter.com/2/oauth2/token",
      codeVerifier: codeVerifier,
      state: state,
    },
  };

  const P = PROVIDERS[provider];
  if (!P) {
    // Return structured error so renderer can display it instead of crashing main
    return { success: false, error: { message: "Unknown provider" } };
  }

  // Debug logging
  console.warn(`[OAuth Debug] Provider: ${provider}`);
  console.warn(`[OAuth Debug] Client ID: ${P.clientId}`);
  console.warn(`[OAuth Debug] Auth URL: ${P.authUrl}`);

  // Check if credentials are configured - require clientId but allow empty clientSecret for providers that use PKCE
  // Treat empty string, placeholder values, or undefined as "not configured"
  const clientIdInvalid = !P.clientId || 
                          P.clientId.trim() === "" ||
                          P.clientId.toLowerCase().startsWith("your") || 
                          P.clientId.toLowerCase().includes("test") ||
                          P.clientId.toLowerCase().includes("placeholder");
  
  if (clientIdInvalid) {
    return {
      success: false,
      error: {
        message: `${provider} credentials not configured. Please configure in the provider settings.`,
      },
    };
  }
  try {
    let resolved = false; // Track if promise has been resolved

    return new Promise((resolve, reject) => {
    // For Twitter, use system browser (Electron has rendering issues with Twitter)
    if (provider === "twitter") {
      const { shell } = require("electron");

      // Store pending request info for callback handler
      pendingOAuthRequests.set("twitter", {
        clientId: P.clientId,
        clientSecret: P.clientSecret,
        codeVerifier: P.codeVerifier,
        state: P.state,
        resolve,
        reject,
      });

      shell.openExternal(P.authUrl);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (pendingOAuthRequests.has("twitter")) {
          pendingOAuthRequests.delete("twitter");
          reject(new Error("Twitter OAuth timed out - please try again"));
        }
      }, 300000);

      return; // Exit early, callback will be handled by server
    }

    const authWin = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWin.loadURL(P.authUrl);

    const handleRedirect = async (event2, url) => {
      try {
        if (!url) {return;}
        // Accept either the configured REDIRECT_URI or the provider-specific redirectUri
        const providerRedirect = P.redirectUri || REDIRECT_URI;
        if (!url.startsWith(REDIRECT_URI) && !url.startsWith(providerRedirect)) {
          return;
        }
        if (resolved) {
          return; // Already handled
        }

        event2.preventDefault();
        const parsed = new URL(url);
        const code =
          parsed.searchParams.get("code") ||
          new URLSearchParams(parsed.hash?.slice(1) || "").get("access_token");

        if (!code) {
          resolved = true;
          authWin.close();
          reject(new Error("No authorization code returned"));
          return;
        }

        // Exchange code for token
        const body = new URLSearchParams();
        body.append("client_id", P.clientId);
        body.append("client_secret", P.clientSecret);
        body.append("grant_type", "authorization_code");
        body.append("redirect_uri", REDIRECT_URI);
        body.append("code", code);

        // Add code_verifier for TikTok and Twitter PKCE
        if (
          (provider === "tiktok" || provider === "twitter") &&
          P.codeVerifier
        ) {
          body.append("code_verifier", P.codeVerifier);
        }

        const tokenResp = await fetch(P.tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
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
          reject(new Error("No access token in response"));
          return;
        }

        // Persist token securely
        try {
          tokenStore.saveToken(provider, token, tokenData.expires_in || null);
        } catch (e) {
          logError("Failed to persist token:", e);
        }

        // Send token back to renderer
        event.sender.send("oauth-token", { provider, token });

        resolved = true;
        authWin.close();
        // Return structured success
        resolve({ success: true, provider, token });
      } catch (err) {
        console.error("OAuth error:", err);
        if (!resolved) {
          resolved = true;
          authWin.close();
          reject(err);
        }
      }
    };

    // Handle redirects for OAuth flow
    authWin.webContents.on("will-redirect", handleRedirect);
    authWin.webContents.on("will-navigate", handleRedirect);

    // Handle window close
    authWin.on("closed", () => {
      if (!resolved) {
        // Treat window close as a user cancellation (benign)
        resolved = true;
        resolve({ success: false, reason: "canceled" });
      }
    });
  });
  } catch (err) {
    // Catch any unexpected errors and return structured error instead of throwing
    logError("start-oauth handler error:", err);
    return { success: false, error: { message: err.message || String(err) } };
  }
});
// Helper function to get validator for file
function getValidatorForFile(filePath) {
  const filename = path.basename(filePath);

  switch (filename) {
    case "settings.json": {
      return validateSettings;
    }
    case "scheduledPosts.json": {
      return validateScheduledPosts;
    }
    case "savedConfigs.json": {
      return validateSavedConfigs;
    }
    case "library.json": {
      return validateLibrary;
    }
    case "activity_log.json": {
      return validateActivityLog;
    }
    default: {
      return null;
    }
  }
}

// IPC handler: read a file
ipcMain.handle("READ_FILE", async (_evt, filePath) => {
  console.warn("[IPC] READ_FILE:", filePath);
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: write a file WITH VALIDATION
ipcMain.handle("WRITE_FILE", async (_evt, { filePath, content }) => {
  console.warn("[IPC] WRITE_FILE:", filePath);
  try {
    // If attempting to write settings.json shortly after a reset, block writes that reintroduce provider configs.
    try {
      if (path.basename(filePath) === "settings.json") {
        const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8") || "{}") : {};
        const lastReset = existing.__last_reset ? new Date(existing.__last_reset) : null;
        if (lastReset) {
          const now = new Date();
          const diff = now - lastReset;
          if (diff < 15000) {
            // If incoming content reintroduces provider configs, reject the write to avoid undoing reset
            let incoming = {};
            try {
              incoming = JSON.parse(content || "{}");
            } catch {
              // invalid JSON - let validator handle this later
            }
            if (incoming.providers && Object.keys(incoming.providers).length > 0) {
              return {
                success: false,
                error: { message: "Write blocked: settings were recently reset. Please retry after a moment." },
              };
            }
          }
        }
      }
    } catch (e) {
      logError("Error during WRITE_FILE pre-check:", e);
    }
    const validator = getValidatorForFile(filePath);

    if (validator) {
      let data;
      try {
        data = JSON.parse(content);
      } catch (parseError) {
        return {
          success: false,
          error: {
            message: "Invalid JSON format",
            details: parseError.message,
          },
        };
      }

      const { valid, errors } = validator(data);
      if (!valid) {
        return {
          success: false,
          error: {
            message: "Validation failed",
            details: errors,
          },
        };
      }
    }

    await fs.promises.writeFile(filePath, content, "utf-8");
    return { success: true };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: encrypt data
ipcMain.handle("ENCRYPT_DATA", async (_evt, plaintext) => {
  try {
    const encrypted = encrypt(plaintext);
    return { success: true, data: encrypted };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: decrypt data
ipcMain.handle("DECRYPT_DATA", async (_evt, ciphertext) => {
  try {
    const decrypted = decrypt(ciphertext);
    return { success: true, data: decrypted };
  } catch (error) {
    return { success: false, error: { message: error.message } };
  }
});

// IPC handler: refresh token for a provider
 ipcMain.handle(IPC_CHANNELS.REFRESH_AUTH, async (_evt, provider) => {
  try {
    const saved = tokenStore.loadToken(provider);
    if (!saved || !saved.refreshToken) {
      return { success: false, error: { message: "No refresh token available" } };
    }

    // Build provider-specific refresh requests
    if (provider === "youtube") {
      // Google token refresh
      const body = new URLSearchParams();
      body.append("client_id", process.env.YOUTUBE_CLIENT_ID);
      body.append("client_secret", process.env.YOUTUBE_CLIENT_SECRET);
      body.append("grant_type", "refresh_token");
      body.append("refresh_token", saved.refreshToken);

      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!resp.ok) {
        const text = await resp.text();
        return { success: false, error: { message: `Refresh failed: ${text}` } };
      }

      const data = await resp.json();
      const newToken = data.access_token;
      const newRefresh = data.refresh_token || saved.refreshToken;
      tokenStore.saveToken(provider, newToken, data.expires_in || null, newRefresh);
      return { success: true, token: newToken };
    }

    // Other providers: best-effort or not supported
    return { success: false, error: { message: "Refresh not implemented for this provider" } };
  } catch (err) {
    logError("REFRESH_AUTH error:", err);
    return { success: false, error: { message: err.message || String(err) } };
  }
});

// IPC handler: disconnect provider (revoke if possible, then delete local token)
ipcMain.handle("DISCONNECT_SOCIAL", async (_evt, provider) => {
  try {
    const saved = tokenStore.loadToken(provider);
    if (saved && saved.token) {
      // Attempt provider-specific revocation
      try {
        if (provider === "youtube") {
          // Google revocation endpoint
          const body = new URLSearchParams();
          body.append("token", saved.token);
          await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
        } else if (provider === "twitter") {
          // Attempt Twitter revoke (best-effort)
          const body = new URLSearchParams();
          body.append("token", saved.token);
          body.append("client_id", process.env.TWITTER_CLIENT_ID || "");
          await fetch("https://api.twitter.com/2/oauth2/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
        }
        // For Instagram/TikTok there's no simple universal revoke endpoint; skip and delete local token
      } catch (revokeErr) {
        logError("Token revoke attempt failed:", revokeErr);
        // proceed to delete local token anyway
      }
    }

    const deleted = tokenStore.deleteToken(provider);
    // Notify renderer that token removed
    if (mainWindow && !mainWindow.isDestroyed()) {
      safeSend(mainWindow, "oauth-token-removed", { provider: provider || null });
    }
    return { success: !!deleted };
  } catch (err) {
    logError("DISCONNECT_SOCIAL error:", err);
    return { success: false, error: { message: err.message || String(err) } };
  }
});

// IPC handler: Reset connections and clear activity log
ipcMain.handle(IPC_CHANNELS.RESET_CONNECTIONS, async (_evt, options = {}) => {
  try {
    const dataDir = path.join(__dirname, "data");
    const resetMarkerPath = path.join(dataDir, ".recent_reset");
    const tokensPath = path.join(dataDir, "tokens.json");
    const activityPath = path.join(dataDir, "activity_log.json");
    const settingsPath = path.join(dataDir, "settings.json");

    // Create a transient marker so renderer can detect a reset in progress and avoid
    // immediately re-writing cleared settings (prevents races).
    try {
      fs.writeFileSync(resetMarkerPath, JSON.stringify({ ts: new Date().toISOString() }), "utf-8");
    } catch (e) {
      logError("Failed to create reset marker", e);
    }

    // Remove tokens file if present
    try {
      if (fs.existsSync(tokensPath)) {fs.unlinkSync(tokensPath);}
    } catch (e) {
      logError("Failed to remove tokens.json", e);
    }

    // Clear activity log
    try {
      fs.writeFileSync(activityPath, JSON.stringify([], null, 2));
    } catch (e) {
      logError("Failed to clear activity log", e);
    }

    // Sanitize settings: remove legacy token fields and provider configs by default
    try {
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, "utf8") || "{}";
        const settings = JSON.parse(raw || "{}");

        // Remove legacy token fields
        ["instagramToken", "tiktokToken", "youtubeToken", "twitterToken"].forEach((k) => delete settings[k]);


        // Remove provider runtime configs by default (user expects provider configs to be cleared on reset)
        if (settings.providers && typeof settings.providers === 'object') {
          Object.keys(settings.providers).forEach((p) => delete settings.providers[p]);
        }

        // If performing a full factory reset, remove the providers object entirely so no stale structure remains
        if (options.full && settings.providers) {
          delete settings.providers;
        }

        // If options.full is true, perform a full factory reset: remove AI keys and provider UI fields
        if (options.full) {
          ["openaiApiKey", "runwayApiKey", "aiProvider"].forEach((k) => delete settings[k]);
          ["providerClientId", "providerClientSecret", "providerRedirectUri"].forEach((k) => delete settings[k]);
        }

        // Stamp the settings with a reset timestamp so other processes can detect a recent reset
        try {
          settings.__last_reset = new Date().toISOString();
        } catch {
          // ignore
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        // Inform renderer of the updated settings so it can refresh UI immediately
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            safeSend(mainWindow, "SETTINGS_UPDATED", settings);
          }
        } catch (e) {
          logError("Failed to notify renderer of settings update:", e);
        }
      }
    } catch (e) {
      logError("Failed to sanitize settings tokens", e);
    }

    // Notify renderer to update UI
    try {
      const platforms = ["instagram", "tiktok", "youtube", "twitter"];
      platforms.forEach((p) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          safeSend(mainWindow, "oauth-token-removed", { provider: p || null });
        }
      });
    } catch (e) {
      logError("Failed to notify renderer of reset", e);
    }
    // Notify renderer that reset completed (renderer will add appropriate log/toast)
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
        safeSend(mainWindow, "RESET_DONE", { full: !!options.full });
      }
    } catch (e) {
      logError("Failed to send RESET_DONE to renderer", e);
    }
    // Remove the transient reset marker now that reset is complete and renderer has been notified
    try {
      if (fs.existsSync(resetMarkerPath)) {fs.unlinkSync(resetMarkerPath);}
    } catch (e) {
      logError("Failed to remove reset marker", e);
    }
    return { success: true };
  } catch (err) {
    logError("RESET_CONNECTIONS error:", err);
    return { success: false, error: { message: err.message || String(err) } };
  }
});

// Auto-Scheduler Function
function startScheduler() {
  schedulerInterval = setInterval(async () => {
    try {
      const scheduledPostsPath = path.join(
        __dirname,
        "data",
        "scheduledPosts.json",
      );

      if (!fs.existsSync(scheduledPostsPath)) {
        return;
      }

      const content = await fs.promises.readFile(scheduledPostsPath, "utf-8");
      const data = JSON.parse(content);
      const posts = data.posts || [];

      const now = new Date();
      const postsToExecute = posts.filter((post) => {
        if (post.posted) {
          return false;
        }

        const scheduledTime = new Date(post.scheduledTime);
        return scheduledTime <= now;
      });

      for (const post of postsToExecute) {
        console.warn(
          `[Scheduler] Executing scheduled post: ${post.scheduledTime}`,
        );

        // Mark as posted
        post.posted = true;
        post.postedAt = new Date().toISOString();

        // Send to renderer to execute
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          safeSend(windows[0], "EXECUTE_SCHEDULED_POST", post || null);
        }
      }

      // Save updated posts
      if (postsToExecute.length > 0) {
        await fs.promises.writeFile(
          scheduledPostsPath,
          JSON.stringify(data, null, 2),
          "utf-8",
        );
      }
    } catch (error) {
      console.error("[Scheduler] Error:", error.message);
    }
  }, 60000); // Check every minute

  console.warn("[Scheduler] Started - checking every 60 seconds");
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.warn("[Scheduler] Stopped");
  }
}

app.on("before-quit", () => {
  stopScheduler();
});
