// Video Generation Handlers
const { memeToVideo, createSlideshow, videoToGif } = require('../utils/video-manager');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { logError } = require('../utils/logger');

// Generate unique temp file path
function getTempPath(ext) {
  const tmpdir = os.tmpdir();
  const hash = crypto.randomBytes(6).toString('hex');
  return path.join(tmpdir, `video_${hash}.${ext}`);
}

// Download a file from URL to local temp path
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const tempPath = getTempPath('jpg');
    const file = fs.createWriteStream(tempPath);

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', (err) => {
      fs.unlink(tempPath, () => {}); // Clean up
      reject(err);
    });
  });
}

// Helper to handle path or URL
async function getLocalPath(pathOrUrl) {
  // If it's a URL, download it first
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return await downloadFile(pathOrUrl);
  }
  // If it's already a local path, return as-is
  return pathOrUrl;
}

// Register all video-related IPC handlers
function registerVideoHandlers(ipcMain, BrowserWindow) {
  // Handle meme to video conversion
  ipcMain.handle('GENERATE_VIDEO', async (event, params) => {
    // Security: Validate input parameters
    if (!params || typeof params !== 'object') {
      return { success: false, error: 'Invalid parameters' };
    }

    const { imagePath, duration, resolution, fps } = params;

    // Validate required fields
    if (!imagePath || typeof imagePath !== 'string') {
      return { success: false, error: 'Invalid image path' };
    }
    if (typeof duration !== 'number' || duration < 1 || duration > 60) {
      return { success: false, error: 'Duration must be between 1 and 60 seconds' };
    }
    if (fps && (typeof fps !== 'number' || fps < 1 || fps > 60)) {
      return { success: false, error: 'FPS must be between 1 and 60' };
    }

    const outputPath = getTempPath('mp4');

    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const updateProgress = (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('VIDEO_PROGRESS', progress);
        }
      };

      updateProgress({ type: 'video', status: 'downloading', progress: 10 });

      // Download if URL, or use local path
      const localImagePath = await getLocalPath(imagePath);

      updateProgress({ type: 'video', status: 'processing', progress: 30 });

      const result = await memeToVideo(localImagePath, {
        duration,
        outputPath,
        resolution,
        fps
      });

      updateProgress({ type: 'video', status: 'complete', progress: 100 });

      // Clean up downloaded temp file if it was a URL
      if (localImagePath !== imagePath) {
        fs.unlink(localImagePath, () => {});
      }

      return result;
    } catch (error) {
      logError('Video generation failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle slideshow creation
  ipcMain.handle('GENERATE_SLIDESHOW', async (event, params) => {
    // Security: Validate input parameters
    if (!params || typeof params !== 'object') {
      return { success: false, error: 'Invalid parameters' };
    }

    const { imagePaths, duration, resolution, transition, fps } = params;

    // Validate required fields
    if (!Array.isArray(imagePaths) || imagePaths.length === 0 || imagePaths.length > 100) {
      return { success: false, error: 'Image paths must be an array with 1-100 items' };
    }
    if (!imagePaths.every(path => typeof path === 'string')) {
      return { success: false, error: 'All image paths must be strings' };
    }
    if (typeof duration !== 'number' || duration < 1 || duration > 10) {
      return { success: false, error: 'Duration per image must be between 1 and 10 seconds' };
    }
    if (fps && (typeof fps !== 'number' || fps < 1 || fps > 60)) {
      return { success: false, error: 'FPS must be between 1 and 60' };
    }

    const outputPath = getTempPath('mp4');

    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const updateProgress = (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('VIDEO_PROGRESS', progress);
        }
      };

      updateProgress({ type: 'slideshow', status: 'downloading', progress: 10 });

      // Download all remote images
      const localImagePaths = await Promise.all(
        imagePaths.map(path => getLocalPath(path))
      );

      updateProgress({ type: 'slideshow', status: 'processing', progress: 30 });

      const result = await createSlideshow(localImagePaths, {
        duration,
        outputPath,
        resolution,
        transition,
        fps
      });

      updateProgress({ type: 'slideshow', status: 'complete', progress: 100 });

      // Clean up downloaded temp files
      localImagePaths.forEach((localPath, index) => {
        if (localPath !== imagePaths[index]) {
          fs.unlink(localPath, () => {});
        }
      });

      return result;
    } catch (error) {
      logError('Slideshow generation failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle GIF creation
  ipcMain.handle('GENERATE_GIF', async (event, params) => {
    // Security: Validate input parameters
    if (!params || typeof params !== 'object') {
      return { success: false, error: 'Invalid parameters' };
    }

    const { imagePath, width, height, duration, fps } = params;

    // Validate required fields
    if (!imagePath || typeof imagePath !== 'string') {
      return { success: false, error: 'Invalid image path' };
    }
    if (width && (typeof width !== 'number' || width < 100 || width > 4000)) {
      return { success: false, error: 'Width must be between 100 and 4000 pixels' };
    }
    if (height && (typeof height !== 'number' || height < 100 || height > 4000)) {
      return { success: false, error: 'Height must be between 100 and 4000 pixels' };
    }
    if (typeof duration !== 'number' || duration < 1 || duration > 60) {
      return { success: false, error: 'Duration must be between 1 and 60 seconds' };
    }
    if (fps && (typeof fps !== 'number' || fps < 1 || fps > 60)) {
      return { success: false, error: 'FPS must be between 1 and 60' };
    }

    const outputPath = getTempPath('gif');

    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const updateProgress = (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('VIDEO_PROGRESS', progress);
        }
      };

      updateProgress({ type: 'gif', status: 'downloading', progress: 10 });

      // Download if URL
      const localImagePath = await getLocalPath(imagePath);

      updateProgress({ type: 'gif', status: 'processing', progress: 30 });

      const result = await videoToGif(localImagePath, {
        width,
        height,
        duration,
        outputPath,
        fps
      });

      updateProgress({ type: 'gif', status: 'complete', progress: 100 });

      // Clean up downloaded temp file
      if (localImagePath !== imagePath) {
        fs.unlink(localImagePath, () => {});
      }

      return result;
    } catch (error) {
      logError('GIF generation failed:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerVideoHandlers };
