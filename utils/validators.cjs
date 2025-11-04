// Security: Maximum allowed lengths to prevent DoS
const MAX_STRING_LENGTH = 10000;
const MAX_ARRAY_LENGTH = 1000;

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// Security: Check for prototype pollution attempts
const hasDangerousKeys = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  return Object.keys(obj).some(key => dangerous.includes(key));
};

const validateDateTime = (v) => {
  if (!isNonEmptyString(v)) {
    return false;
  }
  const date = new Date(v);
  return !isNaN(date.getTime()) && v.includes("T");
};

const validatePlatform = (v) => {
  const validPlatforms = ["instagram", "tiktok", "youtube", "twitter"];
  return typeof v === "string" && validPlatforms.includes(v.toLowerCase());
};

const validateRecurrence = (v) => {
  const validRecurrence = ["none", "daily", "weekly"];
  return typeof v === "string" && validRecurrence.includes(v.toLowerCase());
};

const validateTimezone = (v) => {
  if (!isNonEmptyString(v)) {
    return false;
  }
  if (v === "UTC") {
    return true;
  }
  // Security: Prevent path traversal attempts disguised as timezones
  if (v.includes('..') || v.includes('\\') || v.includes('//')) {
    return false;
  }
  // Valid timezone format: Continent/City
  if (v.includes("/")) {
    const parts = v.split("/");
    if (parts.length !== 2) {return false;}
    if (parts[0].length === 0 || parts[1].length === 0) {return false;}
    // Both parts should be alphanumeric with underscores only
    const validPart = /^[A-Za-z_]+$/;
    if (!validPart.test(parts[0]) || !validPart.test(parts[1])) {return false;}
    return true;
  }
  try {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      return Intl.supportedValuesOf("timeZone").includes(v);
    }
  } catch {
    /* ignore */
  }
  return false;
};

const validateSettings = (obj) => {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["Settings must be an object"] };
  }

  // Security: Check for prototype pollution
  if (hasDangerousKeys(obj)) {
    return { valid: false, errors: ["Invalid object keys detected"] };
  }

  if ("timezoneSelect" in obj && !validateTimezone(obj.timezoneSelect)) {
    errors.push("Invalid timezone selected");
  }
  if ("contentType" in obj) {
    const validTypes = ["meme", "video", "text"];
    if (!validTypes.includes(String(obj.contentType))) {
      errors.push(
        `Invalid contentType. Must be one of: ${validTypes.join(", ")}`,
      );
    }
  }
  if ("hashtagMode" in obj) {
    const validModes = ["manual", "auto"];
    if (!validModes.includes(String(obj.hashtagMode))) {
      errors.push(
        `Invalid hashtagMode. Must be one of: ${validModes.join(", ")}`,
      );
    }
  }
  if ("memeMode" in obj) {
    const validMemeModes = [
      "template",
      "ai-generate",
      "ai-edit",
      "ai-variations",
    ];
    if (!validMemeModes.includes(String(obj.memeMode))) {
      errors.push(
        `Invalid memeMode. Must be one of: ${validMemeModes.join(", ")}`,
      );
    }
  }

  if ("platforms" in obj) {
    if (!Array.isArray(obj.platforms)) {
      errors.push("platforms must be an array");
    } else if (obj.platforms.length > MAX_ARRAY_LENGTH) {
      errors.push(`platforms array too large (max ${MAX_ARRAY_LENGTH})`);
    } else {
      obj.platforms.forEach((platform, idx) => {
        if (!validatePlatform(platform)) {
          errors.push(`Invalid platform at index ${idx}: "${platform}"`);
        }
      });
    }
  }
  if ("darkMode" in obj && typeof obj.darkMode !== "boolean") {
    errors.push("darkMode must be a boolean");
  }
  if ("recurrence" in obj && !validateRecurrence(obj.recurrence)) {
    errors.push("Invalid recurrence value");
  }

  // Validate aiProvider if present (optional field)
  if ("aiProvider" in obj) {
    const validProviders = ["openai", "runway", ""];
    const providerValue = String(obj.aiProvider);
    if (!validProviders.includes(providerValue)) {
      errors.push(`Invalid aiProvider: "${providerValue}". Must be one of: openai, runway, or empty`);
    }
  }

  const encryptedFields = [
    "openaiApiKey",
    "runwayApiKey",
    "lumaApiKey",
    "instagramToken",
    "tiktokToken",
    "youtubeToken",
    "twitterToken",
  ];
  encryptedFields.forEach((field) => {
    if (field in obj) {
      if (obj[field] !== "" && typeof obj[field] !== "string") {
        errors.push(`${field} must be a string or empty string`);
      } else if (typeof obj[field] === "string" && obj[field].length > MAX_STRING_LENGTH) {
        errors.push(`${field} exceeds maximum length`);
      }
    }
  });

  // Security: Check for unexpected extra keys (optional - can be relaxed)
  const allowedKeys = [
    'timezoneSelect', 'contentType', 'hashtagMode', 'memeMode', 'platforms',
    'darkMode', 'recurrence', 'aiProvider', ...encryptedFields, 'caption', 'hashtags',
    'customText', 'postingSchedule', 'autoPost', 'scheduleTime', 'fieldsetLayout',
    'isDarkMode'
  ];

  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      errors.push(`Unexpected key in settings: ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

const validateScheduledPost = (post) => {
  const errors = [];
  if (!post || typeof post !== "object") {
    return { valid: false, errors: ["Post must be an object"] };
  }

  // Security: Check for prototype pollution
  if (hasDangerousKeys(post)) {
    return { valid: false, errors: ["Invalid object keys detected"] };
  }

  const required = ["id", "scheduleTime", "content", "createdAt"];
  for (const field of required) {
    if (!isNonEmptyString(post[field])) {
      errors.push(`Missing or invalid required field: ${field}`);
    } else if (post[field].length > MAX_STRING_LENGTH) {
      errors.push(`Field ${field} exceeds maximum length`);
    }
  }
  if ("createdAt" in post && !validateDateTime(post.createdAt)) {
    errors.push("Invalid createdAt format - must be ISO 8601");
  }
  if (post.platforms) {
    if (!Array.isArray(post.platforms)) {
      errors.push("platforms must be an array");
    } else if (post.platforms.length > MAX_ARRAY_LENGTH) {
      errors.push("platforms array too large");
    } else {
      post.platforms.forEach((platform, idx) => {
        if (!validatePlatform(platform)) {
          errors.push(`Invalid platform at index ${idx}: "${platform}"`);
        }
      });
    }
  }
  if (post.recurrence && !validateRecurrence(post.recurrence)) {
    errors.push("Invalid recurrence value");
  }
  if (post.timezone && !validateTimezone(post.timezone)) {
    errors.push("Invalid timezone");
  }
  if (post.status) {
    const validStatuses = ["pending", "scheduled", "posted", "failed", "draft"];
    if (!validStatuses.includes(String(post.status))) {
      errors.push("Invalid status");
    }
  }
  return { valid: errors.length === 0, errors };
};

const validateScheduledPosts = (obj) => {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["scheduledPosts must be an object"] };
  }
  if (!("posts" in obj)) {
    return { valid: false, errors: ['Missing "posts" array'] };
  }
  if (!Array.isArray(obj.posts)) {
    return { valid: false, errors: ['"posts" must be an array'] };
  }
  obj.posts.forEach((post, idx) => {
    const result = validateScheduledPost(post);
    if (!result.valid) {
      errors.push(`Post at index ${idx}: ${result.errors.join("; ")}`);
    }
  });
  const ids = obj.posts.map((p) => p.id).filter((id) => id);
  const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    errors.push(
      `Duplicate post IDs found: ${[...new Set(duplicates)].join(", ")}`,
    );
  }
  return { valid: errors.length === 0, errors };
};

const validateSavedConfigs = (obj) => {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["savedConfigs must be an object"] };
  }
  if (!("configs" in obj)) {
    return { valid: false, errors: ['Missing "configs" array'] };
  }
  if (!Array.isArray(obj.configs)) {
    return { valid: false, errors: ['"configs" must be an array'] };
  }
  obj.configs.forEach((config, index) => {
    if (!config.name || typeof config.name !== "string") {
      errors.push(`Config at index ${index}: Missing or invalid 'name' field`);
    }
    if (!config.settings) {
      errors.push(`Config at index ${index}: Missing 'settings' object`);
    } else {
      const settingsValidation = validateSettings(config.settings);
      if (!settingsValidation.valid) {
        errors.push(
          `Config "${config.name}" at index ${index}: ${settingsValidation.errors.join("; ")}`,
        );
      }
    }
  });
  return { valid: errors.length === 0, errors };
};

const validateLibrary = (obj) => {
  const errors = [];
  if (!Array.isArray(obj)) {
    return { valid: false, errors: ["library must be an array"] };
  }
  obj.forEach((item, index) => {
    const prefix = `Item at index ${index}:`;
    if (!item || typeof item !== "object") {
      errors.push(`${prefix} Must be an object`);
      return;
    }
    if (!item.id || typeof item.id !== "string") {
      errors.push(`${prefix} Missing or invalid 'id'`);
    }
    if (!item.url || typeof item.url !== "string") {
      errors.push(`${prefix} Missing or invalid 'url'`);
    }
    if (!item.type || !["meme", "video", "text"].includes(item.type)) {
      errors.push(`${prefix} Invalid 'type' (must be meme, video, or text)`);
    }
    if (!item.createdAt || !validateDateTime(item.createdAt)) {
      errors.push(`${prefix} Invalid 'createdAt' timestamp`);
    }
    if ("metadata" in item && typeof item.metadata !== "object") {
      errors.push(`${prefix} 'metadata' must be an object`);
    }
  });
  return { valid: errors.length === 0, errors };
};

const validateActivityLog = (obj) => {
  const errors = [];
  const arr = Array.isArray(obj)
    ? obj
    : obj && Array.isArray(obj.logs)
      ? obj.logs
      : null;
  if (!arr) {
    return { valid: false, errors: ['Missing "logs" array'] };
  }
  arr.forEach((log, index) => {
    const prefix = `Log at index ${index}:`;
    if (!log || typeof log !== "object") {
      errors.push(`${prefix} Must be an object`);
      return;
    }
    if (!log.ts || !validateDateTime(log.ts)) {
      errors.push(`${prefix} Invalid 'ts'`);
    }
    if (!("text" in log) || typeof log.text !== "string") {
      errors.push(`${prefix} Missing or invalid 'text'`);
    }
    if (
      "status" in log &&
      !["success", "error", "warning", "info"].includes(log.status)
    ) {
      errors.push(
        `${prefix} Invalid 'status' (must be success, error, warning, or info)`,
      );
    }
  });
  return { valid: errors.length === 0, errors };
};

/**
 * Validate analytics data structure
 * @param {Object} data - Analytics data to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateAnalytics(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Analytics data must be an object" };
  }

  if (hasDangerousKeys(data)) {
    return { valid: false, error: "Analytics data contains dangerous keys" };
  }

  // Validate posts array
  if (!Array.isArray(data.posts)) {
    return { valid: false, error: "posts must be an array" };
  }

  if (data.posts.length > MAX_ARRAY_LENGTH) {
    return { valid: false, error: `posts array exceeds maximum length of ${MAX_ARRAY_LENGTH}` };
  }

  // Validate each post
  for (let i = 0; i < data.posts.length; i++) {
    const post = data.posts[i];

    if (!post || typeof post !== "object") {
      return { valid: false, error: `Post at index ${i} must be an object` };
    }

    // Required fields
    if (!isNonEmptyString(post.id)) {
      return { valid: false, error: `Post at index ${i} missing id` };
    }

    if (post.id.length > MAX_STRING_LENGTH) {
      return { valid: false, error: `Post at index ${i} id exceeds maximum length` };
    }

    if (!validatePlatform(post.platform)) {
      return { valid: false, error: `Post at index ${i} has invalid platform` };
    }

    if (!validateDateTime(post.timestamp)) {
      return { valid: false, error: `Post at index ${i} has invalid timestamp` };
    }

    // Optional numeric fields (must be non-negative)
    const numericFields = ['impressions', 'engagement', 'clicks', 'shares', 'likes', 'comments'];
    for (const field of numericFields) {
      if (post[field] !== undefined) {
        if (typeof post[field] !== 'number' || post[field] < 0 || !Number.isFinite(post[field])) {
          return { valid: false, error: `Post at index ${i} has invalid ${field}` };
        }
      }
    }

    // Optional contentType
    if (post.contentType !== undefined) {
      if (!isNonEmptyString(post.contentType)) {
        return { valid: false, error: `Post at index ${i} has invalid contentType` };
      }
      if (post.contentType.length > MAX_STRING_LENGTH) {
        return { valid: false, error: `Post at index ${i} contentType exceeds maximum length` };
      }
    }
  }

  // Validate summary object
  if (!data.summary || typeof data.summary !== "object") {
    return { valid: false, error: "summary must be an object" };
  }

  if (hasDangerousKeys(data.summary)) {
    return { valid: false, error: "summary contains dangerous keys" };
  }

  // Validate summary numeric fields
  const summaryFields = ['totalPosts', 'totalImpressions', 'totalEngagement', 'avgEngagementRate'];
  for (const field of summaryFields) {
    if (data.summary[field] !== undefined) {
      if (typeof data.summary[field] !== 'number' || data.summary[field] < 0 || !Number.isFinite(data.summary[field])) {
        return { valid: false, error: `summary.${field} must be a non-negative number` };
      }
    }
  }

  // Validate platforms object
  if (data.summary.platforms && typeof data.summary.platforms === 'object') {
    if (hasDangerousKeys(data.summary.platforms)) {
      return { valid: false, error: "summary.platforms contains dangerous keys" };
    }

    for (const [platform, stats] of Object.entries(data.summary.platforms)) {
      if (!validatePlatform(platform)) {
        return { valid: false, error: `Invalid platform in summary: ${platform}` };
      }

      if (!stats || typeof stats !== 'object') {
        return { valid: false, error: `Platform stats for ${platform} must be an object` };
      }

      const platformFields = ['posts', 'impressions', 'engagement'];
      for (const field of platformFields) {
        if (stats[field] !== undefined) {
          if (typeof stats[field] !== 'number' || stats[field] < 0 || !Number.isFinite(stats[field])) {
            return { valid: false, error: `${platform}.${field} must be a non-negative number` };
          }
        }
      }
    }
  }

  // Validate lastUpdated
  if (data.lastUpdated !== null && data.lastUpdated !== undefined) {
    if (!validateDateTime(data.lastUpdated)) {
      return { valid: false, error: "lastUpdated must be a valid ISO 8601 datetime or null" };
    }
  }

  return { valid: true };
}

/**
 * Validate templates.json structure
 */
function validateTemplates(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: "Templates data must be an object" };
  }

  // Security: Check for prototype pollution
  if (hasDangerousKeys(data)) {
    return { valid: false, error: "Templates data contains dangerous keys" };
  }

  // Validate templates array
  if (!Array.isArray(data.templates)) {
    return { valid: false, error: "templates must be an array" };
  }

  // Security: Limit array size
  if (data.templates.length > MAX_ARRAY_LENGTH) {
    return { valid: false, error: `templates array exceeds maximum length of ${MAX_ARRAY_LENGTH}` };
  }

  // Validate each template
  for (let i = 0; i < data.templates.length; i++) {
    const template = data.templates[i];

    if (!template || typeof template !== 'object') {
      return { valid: false, error: `templates[${i}] must be an object` };
    }

    // Security: Check for dangerous keys
    if (hasDangerousKeys(template)) {
      return { valid: false, error: `templates[${i}] contains dangerous keys` };
    }

    // Required fields
    if (!isNonEmptyString(template.id)) {
      return { valid: false, error: `templates[${i}].id is required and must be a non-empty string` };
    }

    if (!isNonEmptyString(template.name)) {
      return { valid: false, error: `templates[${i}].name is required and must be a non-empty string` };
    }

    // Security: Limit string lengths
    if (template.id.length > MAX_STRING_LENGTH) {
      return { valid: false, error: `templates[${i}].id exceeds maximum length` };
    }

    if (template.name.length > MAX_STRING_LENGTH) {
      return { valid: false, error: `templates[${i}].name exceeds maximum length` };
    }

    // Caption is required
    if (!isNonEmptyString(template.caption)) {
      return { valid: false, error: `templates[${i}].caption is required and must be a non-empty string` };
    }

    if (template.caption.length > MAX_STRING_LENGTH) {
      return { valid: false, error: `templates[${i}].caption exceeds maximum length` };
    }

    // Hashtags (optional)
    if (template.hashtags !== undefined && template.hashtags !== null) {
      if (typeof template.hashtags !== 'string') {
        return { valid: false, error: `templates[${i}].hashtags must be a string` };
      }
      if (template.hashtags.length > MAX_STRING_LENGTH) {
        return { valid: false, error: `templates[${i}].hashtags exceeds maximum length` };
      }
    }

    // Platforms array (optional)
    if (template.platforms !== undefined) {
      if (!Array.isArray(template.platforms)) {
        return { valid: false, error: `templates[${i}].platforms must be an array` };
      }
      if (template.platforms.length > 10) {
        return { valid: false, error: `templates[${i}].platforms array is too long` };
      }
      for (const platform of template.platforms) {
        if (!validatePlatform(platform)) {
          return { valid: false, error: `templates[${i}].platforms contains invalid platform: ${platform}` };
        }
      }
    }

    // Category (optional)
    if (template.category !== undefined && template.category !== null) {
      if (!isNonEmptyString(template.category)) {
        return { valid: false, error: `templates[${i}].category must be a non-empty string` };
      }
      if (template.category.length > 100) {
        return { valid: false, error: `templates[${i}].category exceeds maximum length` };
      }
    }

    // Timestamps
    if (template.createdAt !== undefined && !validateDateTime(template.createdAt)) {
      return { valid: false, error: `templates[${i}].createdAt must be a valid ISO 8601 datetime` };
    }

    if (template.lastUsed !== null && template.lastUsed !== undefined && !validateDateTime(template.lastUsed)) {
      return { valid: false, error: `templates[${i}].lastUsed must be a valid ISO 8601 datetime or null` };
    }

    // Use count (optional)
    if (template.useCount !== undefined) {
      if (typeof template.useCount !== 'number' || template.useCount < 0 || !Number.isInteger(template.useCount)) {
        return { valid: false, error: `templates[${i}].useCount must be a non-negative integer` };
      }
    }
  }

  // Validate variables object (optional)
  if (data.variables !== undefined) {
    if (typeof data.variables !== 'object' || Array.isArray(data.variables)) {
      return { valid: false, error: "variables must be an object" };
    }

    // Security: Check for dangerous keys
    if (hasDangerousKeys(data.variables)) {
      return { valid: false, error: "variables contains dangerous keys" };
    }

    // Validate each variable description
    for (const [key, value] of Object.entries(data.variables)) {
      if (typeof value !== 'string') {
        return { valid: false, error: `variables.${key} must be a string` };
      }
      if (value.length > MAX_STRING_LENGTH) {
        return { valid: false, error: `variables.${key} exceeds maximum length` };
      }
    }
  }

  return { valid: true };
}

module.exports = {
  isNonEmptyString,
  validateTimezone,
  validateDateTime,
  validatePlatform,
  validateRecurrence,
  validateSettings,
  validateScheduledPost,
  validateScheduledPosts,
  validateSavedConfigs,
  validateLibrary,
  validateActivityLog,
  validateAnalytics,
  validateTemplates
};
