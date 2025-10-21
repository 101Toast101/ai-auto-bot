// ImageProcessor.worker.js - Background image processing
const { parentPort } = require('worker_threads');
const sharp = require('sharp');

parentPort.on('message', async (data) => {
  try {
    switch (data.type) {
      case 'RESIZE': {
        const resized = await handleResize(data.image, data.options);
        parentPort.postMessage({ type: 'SUCCESS', result: resized });
        break;
      }

      case 'OPTIMIZE': {
        const optimized = await handleOptimize(data.image, data.options);
        parentPort.postMessage({ type: 'SUCCESS', result: optimized });
        break;
      }

      case 'WATERMARK': {
        const watermarked = await handleWatermark(data.image, data.watermark, data.options);
        parentPort.postMessage({ type: 'SUCCESS', result: watermarked });
        break;
      }

      default:
        throw new Error(`Unknown operation type: ${data.type}`);
    }
  } catch (error) {
    parentPort.postMessage({ type: 'ERROR', error: error.message });
  }
});

async function handleResize(imageBuffer, options) {
  const image = sharp(imageBuffer);

  if (options.width && options.height) {
    return image
      .resize(options.width, options.height, {
        fit: options.fit || 'cover',
        position: options.position || 'center'
      })
      .toBuffer();
  }

  if (options.width) {
    return image.resize(options.width, null).toBuffer();
  }

  if (options.height) {
    return image.resize(null, options.height).toBuffer();
  }

  throw new Error('No valid resize dimensions provided');
}

async function handleOptimize(imageBuffer, options) {
  const image = sharp(imageBuffer);

  return image
    .jpeg({
      quality: options.quality || 80,
      progressive: true,
      force: false
    })
    .png({
      compressionLevel: options.compressionLevel || 9,
      force: false
    })
    .toBuffer();
}

async function handleWatermark(imageBuffer, watermarkBuffer, options) {
  const image = sharp(imageBuffer);
  const watermark = sharp(watermarkBuffer);

  // Resize watermark if needed
  if (options.watermarkScale) {
    const metadata = await image.metadata();
    const watermarkWidth = Math.round(metadata.width * options.watermarkScale);
    await watermark.resize(watermarkWidth, null).toBuffer();
  }

  return image
    .composite([
      {
        input: await watermark.toBuffer(),
        gravity: options.position || 'southeast'
      }
    ])
    .toBuffer();
}
