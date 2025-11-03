// utils/video-providers.js
// Video generation provider abstraction system

/**
 * Base class for all video generation providers
 * All providers must implement generate(), checkStatus(), and getCapabilities()
 */
class VideoProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Start video generation
   * @param {Object} options - Generation options { prompt, duration, aspectRatio, dimensions }
   * @returns {Promise<Object>} { taskId, status, pollInterval }
   */
  async generate(options) {
    throw new Error('generate() must be implemented by provider');
  }

  /**
   * Check generation status
   * @param {string} taskId - Task identifier from generate()
   * @returns {Promise<Object>} { status, progress, videoUrl, error }
   */
  async checkStatus(taskId) {
    throw new Error('checkStatus() must be implemented by provider');
  }

  /**
   * Get provider capabilities and metadata
   * @returns {Object} { maxDuration, aspectRatios, estimatedTime, costPer10s, quality, note }
   */
  getCapabilities() {
    throw new Error('getCapabilities() must be implemented by provider');
  }
}

/**
 * Runway ML Gen-3 Alpha Provider
 * Professional-grade AI video generation with motion understanding
 */
class RunwayProvider extends VideoProvider {
  async generate({ prompt, duration, aspectRatio }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const response = await fetch(
        'https://api.dev.runwayml.com/v1/text_to_video',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'X-Runway-Version': '2024-11-13',
          },
          body: JSON.stringify({
            promptText: prompt,
            duration: Math.min(duration || 5, 10), // Max 10 seconds
            aspectRatio: aspectRatio || '16:9',
            model: 'gen3a_turbo', // Fast model
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = `Runway API error: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.error?.message || error.message || errorMessage;
        } catch {
          const text = await response.text();
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            errorMessage = 'Runway API endpoint error. Please verify your API key is valid for Gen-3 Alpha.';
          } else {
            errorMessage = text || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.id) {
        throw new Error('No task ID returned from Runway API');
      }

      return {
        taskId: data.id,
        status: 'processing',
        pollInterval: 5000, // Check every 5 seconds
      };
    } catch (error) {
      throw new Error(`Runway generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    try {
      const response = await fetch(
        `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Runway-Version': '2024-11-13',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.status}`);
      }

      const data = await response.json();

      // Normalize status to common format
      let normalizedStatus = 'processing';
      if (data.status === 'SUCCEEDED') {
        normalizedStatus = 'completed';
      } else if (data.status === 'FAILED') {
        normalizedStatus = 'failed';
      }

      return {
        status: normalizedStatus,
        progress: data.progress || 0,
        videoUrl: data.output?.[0] || data.video_url,
        error: data.error,
      };
    } catch (error) {
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  getCapabilities() {
    return {
      maxDuration: 10,
      aspectRatios: ['16:9', '9:16', '1:1'],
      estimatedTime: 120, // 2 minutes
      costPer10s: 0.50,
      quality: 'Professional',
      note: 'Best overall quality with motion understanding',
    };
  }
}

/**
 * Luma AI Dream Machine Provider
 * Fast and affordable AI video generation
 */
class LumaProvider extends VideoProvider {
  async generate({ prompt, aspectRatio }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const response = await fetch(
        'https://api.lumalabs.ai/dream-machine/v1/generations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            aspect_ratio: aspectRatio || '16:9',
            loop: false,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = `Luma API error: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.error?.message || error.message || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.id) {
        throw new Error('No task ID returned from Luma API');
      }

      return {
        taskId: data.id,
        status: 'processing',
        pollInterval: 3000, // Check every 3 seconds (Luma is faster)
      };
    } catch (error) {
      throw new Error(`Luma generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    try {
      const response = await fetch(
        `https://api.lumalabs.ai/dream-machine/v1/generations/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.status}`);
      }

      const data = await response.json();

      // Normalize status to common format
      let normalizedStatus = 'processing';
      if (data.state === 'completed') {
        normalizedStatus = 'completed';
      } else if (data.state === 'failed') {
        normalizedStatus = 'failed';
      }

      // Calculate progress estimate
      let progress = 0;
      if (data.state === 'pending') progress = 0.2;
      if (data.state === 'dreaming') progress = 0.5;
      if (data.state === 'completed') progress = 1.0;

      return {
        status: normalizedStatus,
        progress: progress,
        videoUrl: data.assets?.video,
        error: data.failure_reason,
      };
    } catch (error) {
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  getCapabilities() {
    return {
      maxDuration: 5,
      aspectRatios: ['16:9', '9:16', '1:1', '4:3', '21:9'],
      estimatedTime: 60, // 1 minute
      costPer10s: 0.30,
      quality: 'High',
      note: 'Fast generation with good quality',
    };
  }
}

/**
 * OpenAI Provider (Image → Video Conversion)
 * Basic animation fallback using DALL-E + FFmpeg
 */
class OpenAIProvider extends VideoProvider {
  async generate({ prompt, duration, dimensions }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      // Generate image with DALL-E
      const imageResponse = await fetch(
        'https://api.openai.com/v1/images/generations',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            n: 1,
            size: `${dimensions.width}x${dimensions.height}`,
            model: 'dall-e-3',
          }),
        }
      );

      if (!imageResponse.ok) {
        const errorData = await imageResponse.json();
        throw new Error(
          errorData.error?.message || `OpenAI API error: ${imageResponse.status}`
        );
      }

      const imageData = await imageResponse.json();
      const imageUrl = imageData.data[0]?.url;

      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      // Return image URL as taskId (we'll convert it to video in checkStatus)
      return {
        taskId: imageUrl,
        status: 'processing',
        pollInterval: 1000, // Quick check since conversion happens locally
        metadata: {
          duration: duration || 5,
          resolution: `${dimensions.width}x${dimensions.height}`,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId, metadata) {
    // For OpenAI, taskId is the image URL
    // We need to convert it to video using FFmpeg (via main process)
    try {
      const videoResult = await window.api.generateVideo({
        imagePath: taskId, // Image URL
        duration: metadata?.duration || 5,
        resolution: metadata?.resolution || '1024x1024',
        fps: 30,
      });

      if (!videoResult.success) {
        throw new Error(videoResult.error || 'Video conversion failed');
      }

      // Format path for file:// protocol
      const videoPath = videoResult.path.replace(/\\/g, '/');
      const videoFileUrl = videoPath.startsWith('/')
        ? `file://${videoPath}`
        : `file:///${videoPath}`;

      return {
        status: 'completed',
        progress: 1.0,
        videoUrl: videoFileUrl,
        error: null,
      };
    } catch (error) {
      return {
        status: 'failed',
        progress: 0,
        videoUrl: null,
        error: error.message,
      };
    }
  }

  getCapabilities() {
    return {
      maxDuration: 30,
      aspectRatios: ['16:9', '9:16', '1:1'],
      estimatedTime: 45, // 45 seconds
      costPer10s: 0.15,
      quality: 'Basic',
      note: 'Static image with zoom/pan effects',
    };
  }
}

/**
 * Zeroscope V2 Provider (FREE Local AI)
 * Open-source text-to-video model running locally
 * Requires: Python, torch, diffusers
 */
class ZeroscopeProvider extends VideoProvider {
  constructor() {
    super('local'); // No API key needed
  }

  async generate({ prompt, duration, dimensions }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      // Call main process to run local Python model
      const result = await window.api.generateLocalVideo({
        model: 'zeroscope',
        prompt: prompt,
        duration: duration || 3,
        width: dimensions?.width || 576,
        height: dimensions?.height || 320,
      });

      if (!result.success) {
        throw new Error(result.error || 'Zeroscope generation failed');
      }

      return {
        taskId: result.videoPath, // Local path is the task ID
        status: 'completed', // Local generation is synchronous
        pollInterval: 0,
      };
    } catch (error) {
      throw new Error(`Zeroscope generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    // For local models, generation is synchronous
    // taskId is the local file path
    return {
      status: 'completed',
      progress: 1.0,
      videoUrl: `file:///${taskId.replace(/\\/g, '/')}`,
      error: null,
    };
  }

  getCapabilities() {
    return {
      maxDuration: 5,
      aspectRatios: ['16:9'],
      estimatedTime: 180, // 3 minutes (slower on CPU)
      costPer10s: 0.00,
      quality: 'Good',
      note: 'FREE - Runs locally (requires GPU for speed)',
    };
  }
}

/**
 * ModelScope Provider (FREE Local AI)
 * Alibaba's open-source text-to-video model
 * Requires: Python, torch, modelscope
 */
class ModelScopeProvider extends VideoProvider {
  constructor() {
    super('local');
  }

  async generate({ prompt, duration, dimensions }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const result = await window.api.generateLocalVideo({
        model: 'modelscope',
        prompt: prompt,
        duration: duration || 2,
        width: dimensions?.width || 256,
        height: dimensions?.height || 256,
      });

      if (!result.success) {
        throw new Error(result.error || 'ModelScope generation failed');
      }

      return {
        taskId: result.videoPath,
        status: 'completed',
        pollInterval: 0,
      };
    } catch (error) {
      throw new Error(`ModelScope generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    return {
      status: 'completed',
      progress: 1.0,
      videoUrl: `file:///${taskId.replace(/\\/g, '/')}`,
      error: null,
    };
  }

  getCapabilities() {
    return {
      maxDuration: 3,
      aspectRatios: ['1:1'],
      estimatedTime: 120, // 2 minutes
      costPer10s: 0.00,
      quality: 'Fair',
      note: 'FREE - Runs locally (lower resolution)',
    };
  }
}

/**
 * Stable Video Diffusion Provider (FREE Local AI)
 * Stability AI's image-to-video model
 * Requires: Python, torch, diffusers
 */
class StableVideoDiffusionProvider extends VideoProvider {
  constructor() {
    super('local');
  }

  async generate({ prompt, duration, dimensions }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const result = await window.api.generateLocalVideo({
        model: 'stable-diffusion-video',
        prompt: prompt,
        duration: duration || 4,
        width: dimensions?.width || 1024,
        height: dimensions?.height || 576,
      });

      if (!result.success) {
        throw new Error(result.error || 'Stable Video Diffusion failed');
      }

      return {
        taskId: result.videoPath,
        status: 'completed',
        pollInterval: 0,
      };
    } catch (error) {
      throw new Error(`Stable Video Diffusion failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    return {
      status: 'completed',
      progress: 1.0,
      videoUrl: `file:///${taskId.replace(/\\/g, '/')}`,
      error: null,
    };
  }

  getCapabilities() {
    return {
      maxDuration: 5,
      aspectRatios: ['16:9', '9:16'],
      estimatedTime: 240, // 4 minutes
      costPer10s: 0.00,
      quality: 'High',
      note: 'FREE - Runs locally (best quality, slowest)',
    };
  }
}

/**
 * Factory function to create video provider instances
 * @param {string} providerName - 'runway', 'luma', 'openai', 'zeroscope', 'modelscope', 'stable-video'
 * @param {string} apiKey - Provider API key
 * @returns {VideoProvider} Provider instance
 */
export function createVideoProvider(providerName, apiKey) {
  const providers = {
    runway: RunwayProvider,
    luma: LumaProvider,
    openai: OpenAIProvider,
    zeroscope: ZeroscopeProvider,
    modelscope: ModelScopeProvider,
    'stable-video': StableVideoDiffusionProvider,
  };

  const ProviderClass = providers[providerName.toLowerCase()];

  if (!ProviderClass) {
    throw new Error(
      `Unknown provider: ${providerName}. Available providers: ${Object.keys(providers).join(', ')}`
    );
  }

  // Local models don't need API key
  if (providerName === 'zeroscope' || providerName === 'modelscope' || providerName === 'stable-video') {
    return new ProviderClass();
  }

  return new ProviderClass(apiKey);
}

/**
 * Get list of all available providers with their capabilities
 * @returns {Array} Array of { name, displayName, capabilities }
 */
export function getAvailableProviders() {
  return [
    {
      name: 'runway',
      displayName: 'Runway ML Gen-3',
      capabilities: new RunwayProvider('dummy').getCapabilities(),
    },
    {
      name: 'luma',
      displayName: 'Luma Dream Machine',
      capabilities: new LumaProvider('dummy').getCapabilities(),
    },
    {
      name: 'openai',
      displayName: 'OpenAI (Basic Animation)',
      capabilities: new OpenAIProvider('dummy').getCapabilities(),
    },
    {
      name: 'zeroscope',
      displayName: 'Zeroscope V2 (FREE)',
      capabilities: new ZeroscopeProvider().getCapabilities(),
    },
    {
      name: 'modelscope',
      displayName: 'ModelScope (FREE)',
      capabilities: new ModelScopeProvider().getCapabilities(),
    },
    {
      name: 'stable-video',
      displayName: 'Stable Video Diffusion (FREE)',
      capabilities: new StableVideoDiffusionProvider().getCapabilities(),
    },
  ];
}
