const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

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
  if (v.indexOf("/") > -1) {
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
  if ("aiProvider" in obj) {
    const validProviders = ["openai", "runway", ""];
    if (!validProviders.includes(String(obj.aiProvider))) {
      errors.push(
        `Invalid aiProvider. Must be one of: ${validProviders.join(", ")} or empty`,
      );
    }
  }
  if ("platforms" in obj) {
    if (!Array.isArray(obj.platforms)) {
      errors.push("platforms must be an array");
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
  const encryptedFields = [
    "openaiApiKey",
    "runwayApiKey",
    "instagramToken",
    "tiktokToken",
    "youtubeToken",
    "twitterToken",
  ];
  encryptedFields.forEach((field) => {
    if (field in obj && obj[field] !== "" && typeof obj[field] !== "string") {
      errors.push(`${field} must be a string or empty string`);
    }
  });
  return { valid: errors.length === 0, errors };
};

const validateScheduledPost = (post) => {
  const errors = [];
  if (!post || typeof post !== "object") {
    return { valid: false, errors: ["Post must be an object"] };
  }
  const required = ["id", "scheduleTime", "content", "createdAt"];
  for (const field of required) {
    if (!isNonEmptyString(post[field])) {
      errors.push(`Missing or invalid ${field}`);
    }
  }
  if ("scheduleTime" in post && !validateDateTime(post.scheduleTime)) {
    errors.push("Invalid scheduleTime format - must be ISO 8601");
  }
  if ("createdAt" in post && !validateDateTime(post.createdAt)) {
    errors.push("Invalid createdAt format - must be ISO 8601");
  }
  if (post.platforms) {
    if (!Array.isArray(post.platforms)) {
      errors.push("platforms must be an array");
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
};
