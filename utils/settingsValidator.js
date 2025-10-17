// ========================================
// utils/settingsValidator.js
// ========================================
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateTimezone(v) {
  if (!isNonEmptyString(v)) return false;
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone').includes(v);
    }
  } catch (e) {}
  return v === 'UTC' || v.indexOf('/') > -1;
}

function validateSettings(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Settings must be an object'] };
  }

  if ('timezoneSelect' in obj && !validateTimezone(obj.timezoneSelect)) {
    errors.push('Invalid timezone selected');
  }

  if ('contentType' in obj && !['meme', 'video', 'text'].includes(String(obj.contentType))) {
    errors.push('Unknown contentType');
  }

  if ('hashtagMode' in obj && !['manual', 'auto'].includes(String(obj.hashtagMode))) {
    errors.push('Invalid hashtagMode');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateSettings
};