// utils/rate-limiter.js - IPC rate limiting to prevent DoS attacks
const { logWarn, logSecurity, logError } = require('./logger.cjs');

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100; // Max requests per window
    this.windowMs = options.windowMs || 60000; // Time window in ms (default: 1 minute)
    this.requests = new Map(); // Track requests per sender

    // Auto-cleanup old entries every minute
    // Use .unref() to allow process to exit even if timer is pending
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000).unref();
  }

  /**
   * Stop the cleanup timer (useful for testing and graceful shutdown)
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Check if request should be allowed
   * @param {string} senderId - Unique identifier for the sender (e.g., webContents.id)
   * @param {string} channel - IPC channel name
   * @returns {boolean} - True if request is allowed, false if rate limited
   */
  checkLimit(senderId, channel) {
    const key = `${senderId}:${channel}`;
    const now = Date.now();

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key);

    // Remove timestamps outside the current window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    // Check if limit exceeded
    if (validTimestamps.length >= this.maxRequests) {
      logSecurity(`Rate limit exceeded for ${senderId} on ${channel}`);
      return false;
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, timestamps] of this.requests.entries()) {
      // Remove expired timestamps
      const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

      if (validTimestamps.length === 0) {
        keysToDelete.push(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }

    // Delete empty entries
    for (const key of keysToDelete) {
      this.requests.delete(key);
    }

    if (keysToDelete.length > 0) {
      logWarn(`RateLimiter cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Get current request count for a sender/channel
   * @param {string} senderId - Unique identifier for the sender
   * @param {string} channel - IPC channel name
   * @returns {number} - Current request count in window
   */
  getCount(senderId, channel) {
    const key = `${senderId}:${channel}`;
    const timestamps = this.requests.get(key) || [];
    const now = Date.now();
    return timestamps.filter(ts => now - ts < this.windowMs).length;
  }

  /**
   * Reset rate limit for a specific sender/channel
   * @param {string} senderId - Unique identifier for the sender
   * @param {string} channel - IPC channel name (optional, resets all if omitted)
   */
  reset(senderId, channel = null) {
    if (channel) {
      const key = `${senderId}:${channel}`;
      this.requests.delete(key);
    } else {
      // Reset all channels for this sender
      for (const key of this.requests.keys()) {
        if (key.startsWith(`${senderId}:`)) {
          this.requests.delete(key);
        }
      }
    }
  }
}

/**
 * Create a rate-limited IPC handler
 * @param {RateLimiter} limiter - Rate limiter instance
 * @param {Function} handler - Original IPC handler function
 * @param {Object} options - Options for this specific handler
 * @returns {Function} - Rate-limited handler
 */
function createRateLimitedHandler(limiter, handler, options = {}) {
  return async (event, ...args) => {
    const senderId = event.sender.id;
    const channel = options.channel || 'unknown';

    // Check rate limit
    if (!limiter.checkLimit(senderId, channel)) {
      const error = {
        success: false,
        error: {
          message: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        }
      };

      // Log security event
      logSecurity(`Rate limit exceeded: sender=${senderId}, channel=${channel}`);

      return error;
    }

    // Call original handler
    try {
      return await handler(event, ...args);
    } catch (err) {
      logError(`IPC handler error on ${channel}`, err);
      return {
        success: false,
        error: { message: err.message }
      };
    }
  };
}

module.exports = {
  RateLimiter,
  createRateLimitedHandler,
};
