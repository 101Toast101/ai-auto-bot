// ========================================
// preload.js - Secure IPC Bridge
// ========================================

const { contextBridge, ipcRenderer } = require('electron');

// Debug logging
function logDebug(msg) {
  const ts = new Date().toISOString();
  console.warn(`[Preload ${ts}] ${msg}`);
}

logDebug('Initializing IPC bridge...');

/**
 * Exposes secure API to renderer process via window.api
 * All IPC communication flows through these methods
 */
contextBridge.exposeInMainWorld('api', {
  startOAuth: (provider) => ipcRenderer.invoke('start-oauth', provider),
  onOAuthToken: (cb) => ipcRenderer.on('oauth-token', (ev, data) => cb(data)),

  // File Operations
  readFile: (filePath) => ipcRenderer.invoke('READ_FILE', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('WRITE_FILE', { filePath, content }),

  // Encryption Operations
  encrypt: (plaintext) => ipcRenderer.invoke('ENCRYPT_DATA', plaintext),
  decrypt: (ciphertext) => ipcRenderer.invoke('DECRYPT_DATA', ciphertext),

  // Video Operations
  generateVideo: (params) => ipcRenderer.invoke('GENERATE_VIDEO', params),
  generateSlideshow: (params) => ipcRenderer.invoke('GENERATE_SLIDESHOW', params),
  generateGif: (params) => ipcRenderer.invoke('GENERATE_GIF', params),
  generateAiVideo: (params) => ipcRenderer.invoke('GENERATE_AI_VIDEO', params),
  onVideoProgress: (callback) => ipcRenderer.on('VIDEO_PROGRESS', (event, progress) => callback(progress)),

  // Scheduler Listener
  onScheduledPost: (callback) => {
    ipcRenderer.on('EXECUTE_SCHEDULED_POST', (_event, post) => callback(post));
  }
});

logDebug('IPC bridge initialized successfully!');
