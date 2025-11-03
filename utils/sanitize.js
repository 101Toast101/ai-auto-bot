// utils/sanitize.js - HTML sanitization utilities to prevent XSS
const { logSecurity } = require('./logger.cjs');

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} unsafe - Potentially unsafe user input
 * @returns {string} - HTML-escaped safe string
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return String(unsafe || '');
  }

  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\//g, "&#x2F;"); // Forward slash for extra safety
}

/**
 * Safely set text content without HTML parsing
 * Use this instead of innerHTML for user-controlled content
 * @param {HTMLElement} element - DOM element
 * @param {string} text - Text content
 */
function setTextContent(element, text) {
  if (!element) {return;}
  element.textContent = text || '';
}

/**
 * Safely create an element with text content
 * @param {string} tagName - Element tag name (e.g., 'div', 'p', 'span')
 * @param {string} textContent - Safe text content
 * @param {Object} attributes - Optional attributes to set
 * @returns {HTMLElement}
 */
function createSafeElement(tagName, textContent = '', attributes = {}) {
  const element = document.createElement(tagName);
  element.textContent = textContent;

  // Set safe attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') {
      element.className = value;
    } else if (key === 'style') {
      // Allow limited safe style properties
      if (typeof value === 'object') {
        for (const [prop, val] of Object.entries(value)) {
          element.style[prop] = val;
        }
      }
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, String(value));
    } else if (key === 'id' || key === 'title' || key === 'alt') {
      element.setAttribute(key, escapeHtml(String(value)));
    }
  }

  return element;
}

/**
 * Validate and sanitize URL to prevent javascript: and data: schemes
 * @param {string} url - URL to validate
 * @param {string[]} allowedProtocols - Allowed protocols (default: http, https)
 * @returns {string|null} - Sanitized URL or null if invalid
 */
function sanitizeUrl(url, allowedProtocols = ['http:', 'https:', 'file:']) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Block dangerous protocols
    if (!allowedProtocols.includes(parsed.protocol)) {
      logSecurity(`Blocked dangerous URL protocol: ${parsed.protocol}`);
      return null;
    }

    return parsed.toString();
  } catch (err) {
    // Invalid URL
    logSecurity(`Invalid URL: ${err.message}`);
    return null;
  }
}

/**
 * Sanitize filename to prevent path traversal
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Safe filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'untitled';
  }

  // Remove control characters (ASCII 0-31) using string methods instead of regex
  let cleaned = filename;
  for (let i = 0; i <= 31; i++) {
    cleaned = cleaned.split(String.fromCharCode(i)).join('_');
  }

  // Remove path separators and dangerous characters
  return cleaned
    .replace(/[/\\]/g, '_')  // Replace path separators
    .replace(/\.\./g, '_')    // Remove parent directory references
    .replace(/[<>:"|?*]/g, '_')  // Remove invalid filename chars
    .substring(0, 255);  // Limit length
}

/**
 * Validate and limit string length
 * @param {string} str - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} defaultValue - Default if invalid
 * @returns {string} - Validated string
 */
function limitLength(str, maxLength, defaultValue = '') {
  if (typeof str !== 'string') {
    return defaultValue;
  }

  if (str.length > maxLength) {
    logSecurity(`String truncated from ${str.length} to ${maxLength} chars`);
    return str.substring(0, maxLength);
  }

  return str;
}

/**
 * Sanitize object keys to prevent prototype pollution
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object without dangerous keys
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const safe = {};

  for (const key of Object.keys(obj)) {
    if (!dangerous.includes(key)) {
      safe[key] = obj[key];
    } else {
      logSecurity(`Blocked dangerous object key: ${key}`);
    }
  }

  return safe;
}

// Export for CommonJS (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    setTextContent,
    createSafeElement,
    sanitizeUrl,
    sanitizeFilename,
    limitLength,
    sanitizeObject,
  };
}

// Export for browser (global window)
if (typeof window !== 'undefined') {
  window.SecurityUtils = {
    escapeHtml,
    setTextContent,
    createSafeElement,
    sanitizeUrl,
    sanitizeFilename,
    limitLength,
    sanitizeObject,
  };
}
