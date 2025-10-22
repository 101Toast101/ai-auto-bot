const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
const GIFEncoder = require('gif-encoder-2');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

/**
 * Convert a static meme image to an animated video
 * @param {string} imagePath - Path to the meme image
 * @param {Object} options - Animation options
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.outputPath - Path to save the video
 * @param {string} options.resolution - Output resolution (e.g., '1080x1080')
 * @param {number} options.fps - Frames per second
 */
async function memeToVideo(imagePath, options) {
  return new Promise((resolve, reject) => {
    const { duration = 10, outputPath, resolution = '1080x1080', fps = 30 } = options;

    // Parse resolution
    const [width, height] = resolution.split('x').map(Number);

    const args = [
      '-y', // Overwrite output file if exists
      '-loop', '1', // Loop input
      '-i', imagePath, // Input file
      '-t', duration.toString(), // Duration
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, // Simple scale and center
      '-c:v', 'libx264', // Video codec
      '-pix_fmt', 'yuv420p', // Pixel format for compatibility
      '-r', fps.toString(), // Frame rate
      '-preset', 'fast', // Encoding speed
      outputPath // Output file
    ];

    const ffmpegProcess = spawn(ffmpeg, args);
    let error = '';

    ffmpegProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, path: outputPath });
      } else {
        reject({ success: false, error: error || 'FFmpeg process failed' });
      }
    });
  });
}

/**
 * Create a video slideshow from multiple meme images
 * @param {string[]} imagePaths - Array of image paths
 * @param {Object} options - Slideshow options
 * @param {number} options.duration - Duration per image
 * @param {string} options.outputPath - Path to save the video
 * @param {string} options.resolution - Output resolution
 * @param {string} options.transition - Transition effect
 */
async function createSlideshow(imagePaths, options) {
  return new Promise((resolve, reject) => {
    const {
      duration = 3,
      outputPath,
      resolution = '1080x1080',
      transition = 'fade',
      fps = 30
    } = options;

    // Build filter complex for transitions
    const inputs = imagePaths.map(path => ['-loop', '1', '-t', duration.toString(), '-i', path]).flat();
    const filterComplex = [];
    const outputs = [];

    imagePaths.forEach((_, i) => {
      filterComplex.push(`[${i}:v]scale=${resolution},setsar=1[v${i}]`);
      outputs.push(`[v${i}]`);
    });

    // Add crossfade transitions
    const finalFilter = `${filterComplex.join(';')};${outputs.join('')}concat=n=${imagePaths.length}:v=1:a=0,format=yuv420p[v]`;

    const args = [
      '-y',
      ...inputs,
      '-filter_complex', finalFilter,
      '-map', '[v]',
      '-c:v', 'libx264',
      '-r', fps.toString(),
      outputPath
    ];

    const ffmpegProcess = spawn(ffmpeg, args);
    let error = '';

    ffmpegProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, path: outputPath });
      } else {
        reject({ success: false, error: error || 'FFmpeg process failed' });
      }
    });
  });
}

/**
 * Convert a meme image to an animated GIF
 * @param {string} imagePath - Path to the meme image
 * @param {Object} options - GIF options
 * @param {number} options.width - GIF width
 * @param {number} options.height - GIF height
 * @param {number} options.duration - Duration in seconds
 * @param {string} options.outputPath - Path to save the GIF
 */
async function videoToGif(imagePath, options) {
  return new Promise((resolve, reject) => {
    const {
      width = 480,
      height = 480,
      duration = 3,
      outputPath,
      fps = 15
    } = options;

    const args = [
      '-y',
      '-loop', '1',
      '-i', imagePath,
      '-t', duration.toString(),
      '-vf', `scale=${width}:${height},zoompan=z='min(zoom+0.0015,1.1)':d=${duration*fps}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
      '-f', 'gif',
      outputPath
    ];

    const ffmpegProcess = spawn(ffmpeg, args);
    let error = '';

    ffmpegProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, path: outputPath });
      } else {
        reject({ success: false, error: error || 'FFmpeg process failed' });
      }
    });
  });
}

module.exports = {
  memeToVideo,
  createSlideshow,
  videoToGif,
  // Helper function exports
  getTempPath: (ext) => {
    const tmpdir = os.tmpdir();
    const hash = crypto.randomBytes(6).toString('hex');
    return path.join(tmpdir, `video_${hash}.${ext}`);
  }
};
