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
   * @param {Object} _options - Generation options { prompt, duration, aspectRatio, dimensions }
   * @returns {Promise<Object>} { taskId, status, pollInterval }
   */
  async generate(_options) {
    throw new Error('generate() must be implemented by provider');
  }

  /**
   * Check generation status
   * @param {string} _taskId - Task identifier from generate()
   * @returns {Promise<Object>} { status, progress, videoUrl, error }
   */
  async checkStatus(_taskId) {
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
      if (data.state === 'pending') {
        progress = 0.2;
      }
      if (data.state === 'dreaming') {
        progress = 0.5;
      }
      if (data.state === 'completed') {
        progress = 1.0;
      }

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

  async generate({ prompt, duration, dimensions, quality, customSteps }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      // Zeroscope has strict dimension limits - use safe defaults
      const width = Math.min(dimensions?.width || 576, 576);
      const height = Math.min(dimensions?.height || 320, 320);

      // Call main process to run local Python model
      const result = await window.api.generateLocalVideo({
        model: 'zeroscope',
        prompt: prompt,
        duration: duration || 3,
        width: width,
        height: height,
        quality: quality, // Pass quality setting
        customSteps: customSteps, // Pass custom steps if provided
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
      // ModelScope has strict dimension limits
      const width = Math.min(dimensions?.width || 256, 256);
      const height = Math.min(dimensions?.height || 256, 256);

      const result = await window.api.generateLocalVideo({
        model: 'modelscope',
        prompt: prompt,
        duration: duration || 2,
        width: width,
        height: height,
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
 * Haiper AI Provider
 * High-quality AI video generation with creative controls
 * Focus on cinematic quality and motion consistency
 */
class HaiperProvider extends VideoProvider {
  async generate({ prompt, duration, aspectRatio }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const response = await fetch(
        'https://api.haiper.ai/v1/video/generate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            duration: Math.min(duration || 4, 6), // Max 6 seconds
            aspect_ratio: aspectRatio || '16:9',
            model: 'haiper-v2', // Latest model
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = `Haiper API error: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.error?.message || error.message || errorMessage;
        } catch {
          const text = await response.text();
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            errorMessage = 'Haiper API endpoint error. Please verify your API key is valid.';
          } else {
            errorMessage = text || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.task_id && !data.id) {
        throw new Error('No task ID returned from Haiper API');
      }

      return {
        taskId: data.task_id || data.id,
        status: 'processing',
        pollInterval: 4000, // Check every 4 seconds
      };
    } catch (error) {
      throw new Error(`Haiper generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    try {
      const response = await fetch(
        `https://api.haiper.ai/v1/video/status/${taskId}`,
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
      if (data.status === 'completed' || data.status === 'succeeded') {
        normalizedStatus = 'completed';
      } else if (data.status === 'failed' || data.status === 'error') {
        normalizedStatus = 'failed';
      }

      // Calculate progress estimate
      let progress = 0;
      if (data.progress !== undefined) {
        progress = data.progress;
      } else if (data.status === 'pending') {
        progress = 0.1;
      } else if (data.status === 'processing') {
        progress = 0.5;
      } else if (normalizedStatus === 'completed') {
        progress = 1.0;
      }

      return {
        status: normalizedStatus,
        progress: progress,
        videoUrl: data.video_url || data.url || data.output_url,
        error: data.error || data.error_message,
      };
    } catch (error) {
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  getCapabilities() {
    return {
      maxDuration: 6,
      aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
      estimatedTime: 90, // 1.5 minutes
      costPer10s: 0.40,
      quality: 'High',
      note: 'Cinematic quality with excellent motion consistency',
    };
  }
}

/**
 * Pika Labs Provider
 * Advanced AI video generation with creative controls
 * Known for smooth motion and stylistic flexibility
 */
class PikaProvider extends VideoProvider {
  async generate({ prompt, duration, aspectRatio }) {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    try {
      const response = await fetch(
        'https://api.pika.art/v1/generate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            duration: Math.min(duration || 3, 8), // Max 8 seconds
            aspect_ratio: aspectRatio || '16:9',
            motion: 2, // Medium motion intensity
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = `Pika API error: ${response.status}`;
        try {
          const error = await response.json();
          errorMessage = error.error?.message || error.message || errorMessage;
        } catch {
          const text = await response.text();
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            errorMessage = 'Pika API endpoint error. Please verify your API key is valid.';
          } else {
            errorMessage = text || errorMessage;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.job_id && !data.id) {
        throw new Error('No job ID returned from Pika API');
      }

      return {
        taskId: data.job_id || data.id,
        status: 'processing',
        pollInterval: 3500, // Check every 3.5 seconds
      };
    } catch (error) {
      throw new Error(`Pika generation failed: ${error.message}`);
    }
  }

  async checkStatus(taskId) {
    try {
      const response = await fetch(
        `https://api.pika.art/v1/job/${taskId}`,
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
      if (data.status === 'completed' || data.status === 'finished') {
        normalizedStatus = 'completed';
      } else if (data.status === 'failed' || data.status === 'error') {
        normalizedStatus = 'failed';
      }

      // Calculate progress estimate
      let progress = 0;
      if (data.progress !== undefined) {
        progress = data.progress / 100; // Pika returns 0-100
      } else if (data.status === 'queued') {
        progress = 0.1;
      } else if (data.status === 'generating') {
        progress = 0.6;
      } else if (normalizedStatus === 'completed') {
        progress = 1.0;
      }

      return {
        status: normalizedStatus,
        progress: progress,
        videoUrl: data.video_url || data.result_url || data.video,
        error: data.error || data.failure_reason,
      };
    } catch (error) {
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  getCapabilities() {
    return {
      maxDuration: 8,
      aspectRatios: ['16:9', '9:16', '1:1', '4:5'],
      estimatedTime: 75, // 1 minute 15 seconds
      costPer10s: 0.35,
      quality: 'High',
      note: 'Smooth motion with creative flexibility',
    };
  }
}

/**
 * Factory function to create video provider instances
 * @param {string} providerName - 'runway', 'luma', 'openai', 'haiper', 'pika', 'zeroscope', 'modelscope', 'stable-video'
 * @param {string} apiKey - Provider API key
 * @returns {VideoProvider} Provider instance
 */
export function createVideoProvider(providerName, apiKey) {
  const providers = {
    runway: RunwayProvider,
    luma: LumaProvider,
    openai: OpenAIProvider,
    haiper: HaiperProvider,
    pika: PikaProvider,
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
      name: 'haiper',
      displayName: 'Haiper AI',
      capabilities: new HaiperProvider('dummy').getCapabilities(),
    },
    {
      name: 'pika',
      displayName: 'Pika Labs',
      capabilities: new PikaProvider('dummy').getCapabilities(),
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
