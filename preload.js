// preload.js - Secure IPC Bridge

const { contextBridge, ipcRenderer } = require("electron");

// Try to require shared constants; if that fails (sandbox), fall back to inline
let IPC_CHANNELS;
try {
  // Use absolute path to avoid resolution issues in preload
  IPC_CHANNELS = require(require('path').join(__dirname, 'utils', 'ipc-constants.js')).IPC_CHANNELS;
} catch {
  IPC_CHANNELS = {
    READ_FILE: "READ_FILE",
    WRITE_FILE: "WRITE_FILE",
    ENCRYPT_DATA: "ENCRYPT_DATA",
    DECRYPT_DATA: "DECRYPT_DATA",
    START_SCHEDULER: "START_SCHEDULER",
    GENERATE_VIDEO: "GENERATE_VIDEO",
    GENERATE_SLIDESHOW: "GENERATE_SLIDESHOW",
    GENERATE_GIF: "GENERATE_GIF",
    GENERATE_AI_VIDEO: "GENERATE_AI_VIDEO",
    VIDEO_PROGRESS: "VIDEO_PROGRESS",
  };
}

// Debug logging
function logDebug(msg) {
  const ts = new Date().toISOString();
  console.warn(`[Preload ${ts}] ${msg}`);
}

logDebug("Initializing IPC bridge...");

/**
 * Exposes secure API to renderer process via window.api
 * All IPC communication flows through these methods
 */
contextBridge.exposeInMainWorld("api", {
  startOAuth: (provider) => ipcRenderer.invoke("start-oauth", provider),
  onOAuthToken: (cb) => ipcRenderer.on("oauth-token", (_ev, data) => cb(data)),

  // File Operations
  readFile: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, { filePath, content }),

  // Encryption Operations
  encrypt: (plaintext) => ipcRenderer.invoke(IPC_CHANNELS.ENCRYPT_DATA, plaintext),
  decrypt: (ciphertext) => ipcRenderer.invoke(IPC_CHANNELS.DECRYPT_DATA, ciphertext),

  // Video Operations
  generateVideo: (params) => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_VIDEO, params),
  generateSlideshow: (params) => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_SLIDESHOW, params),
  generateGif: (params) => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_GIF, params),
  generateAiVideo: (params) => ipcRenderer.invoke(IPC_CHANNELS.GENERATE_AI_VIDEO, params),
  onVideoProgress: (callback) => ipcRenderer.on(IPC_CHANNELS.VIDEO_PROGRESS, (_event, progress) => callback(progress)),

  // Scheduler Listener
  onScheduledPost: (callback) => {
    ipcRenderer.on("EXECUTE_SCHEDULED_POST", (_event, post) => callback(post));
  },
});

logDebug("IPC bridge initialized successfully!");
