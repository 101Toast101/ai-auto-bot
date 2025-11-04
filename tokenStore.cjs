// tokenStore.cjs
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const TOKEN_PATH = "./data/tokens.json";
const IV_LENGTH = 16;

// Load or derive encryption key
let ENCRYPTION_KEY_BUFFER = null;
if (process.env.ENCRYPTION_KEY) {
  try {
    const buf = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    if (buf.length !== 32) {
      console.warn(
        "[tokenStore] ENCRYPTION_KEY provided but length != 32 bytes (hex). Falling back to ephemeral key.",
      );
    } else {
      ENCRYPTION_KEY_BUFFER = buf;
    }
  } catch {
    console.warn(
      "[tokenStore] Invalid ENCRYPTION_KEY format. Expecting hex-encoded 32-byte key. Falling back to ephemeral key.",
    );
  }
}

if (!ENCRYPTION_KEY_BUFFER) {
  try {
    const dataDir = "./data";
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const keyFile = "./data/.encryption_key";
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, "utf8").trim();
      if (existing && existing.length === 64) {
        ENCRYPTION_KEY_BUFFER = Buffer.from(existing, "hex");
        console.warn(
          "[tokenStore] Using existing key from data/.encryption_key (development mode).",
        );
      }
    }

    if (!ENCRYPTION_KEY_BUFFER) {
      const generated = crypto.randomBytes(32);
      fs.writeFileSync(keyFile, generated.toString("hex"), {
        encoding: "utf8",
        flag: "w",
      });
      try {
        fs.chmodSync(keyFile, 0o600);
      } catch {
        /* ignore */
      }
      ENCRYPTION_KEY_BUFFER = generated;
      console.warn(
        "[tokenStore] Generated development key and saved to data/.encryption_key. DO NOT commit this file.",
      );
    }
  } catch {
    ENCRYPTION_KEY_BUFFER = crypto.randomBytes(32);
    console.warn(
      "[tokenStore] Failed to persist key; using ephemeral key for this process.",
    );
  }
}

const ENCRYPTION_KEY = ENCRYPTION_KEY_BUFFER;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Save a token for a platform account.
 * Supports both single-account (legacy) and multi-account storage.
 *
 * @param {string} platform - Platform name (instagram, tiktok, youtube, twitter)
 * @param {string} token - Access token to save
 * @param {number|null} expiresIn - Token expiration in seconds
 * @param {string|null} refreshToken - Refresh token (if available)
 * @param {Object} accountInfo - Additional account info for multi-account
 * @param {string} accountInfo.accountId - Unique account identifier
 * @param {string} accountInfo.accountName - User-friendly account name
 * @param {string} accountInfo.username - Platform username/handle
 */
function saveToken(platform, token, expiresIn = null, refreshToken = null, accountInfo = null) {
  let tokens = {};
  if (fs.existsSync(TOKEN_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  }

  // If accountInfo provided, use multi-account storage
  if (accountInfo && accountInfo.accountId) {
    if (!tokens[platform]) {
      tokens[platform] = { accounts: [] };
    }

    // Migrate legacy format to multi-account if needed
    if (tokens[platform].token && !tokens[platform].accounts) {
      const legacyAccount = {
        accountId: crypto.randomBytes(16).toString('hex'),
        accountName: 'Default Account',
        username: 'legacy',
        access_token: tokens[platform].token,
        expires_at: tokens[platform].expiresAt,
        refresh_token: tokens[platform].refreshToken,
        isDefault: true,
        connectedAt: new Date().toISOString(),
      };
      tokens[platform] = { accounts: [legacyAccount] };
    }

    // Ensure accounts array exists
    if (!tokens[platform].accounts) {
      tokens[platform].accounts = [];
    }

    // Find existing account or create new
    const existingIndex = tokens[platform].accounts.findIndex(
      acc => acc.accountId === accountInfo.accountId
    );

    const accountData = {
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName || 'Unnamed Account',
      username: accountInfo.username || '',
      access_token: encrypt(token),
      expires_at: expiresIn ? Date.now() + expiresIn * 1000 : null,
      refresh_token: refreshToken ? encrypt(refreshToken) : null,
      isDefault: accountInfo.isDefault !== undefined ? accountInfo.isDefault : (tokens[platform].accounts.length === 0),
      connectedAt: accountInfo.connectedAt || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing account
      tokens[platform].accounts[existingIndex] = accountData;
    } else {
      // Add new account
      tokens[platform].accounts.push(accountData);
    }
  } else {
    // Legacy single-account mode (backward compatibility)
    tokens[platform] = {
      token: encrypt(token),
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
    };
  }

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

/**
 * Load token(s) for a platform.
 * Returns single account (legacy) or default account (multi-account).
 *
 * @param {string} platform - Platform name
 * @param {string|null} accountId - Specific account ID (optional)
 * @returns {Object|null} Token data
 */
function loadToken(platform, accountId = null) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  if (!tokens[platform]) {
    return null;
  }

  const stored = tokens[platform];

  // Multi-account format
  if (stored.accounts && Array.isArray(stored.accounts)) {
    let account;
    if (accountId) {
      // Load specific account
      account = stored.accounts.find(acc => acc.accountId === accountId);
    } else {
      // Load default account
      account = stored.accounts.find(acc => acc.isDefault) || stored.accounts[0];
    }

    if (!account) {
      return null;
    }

    return {
      accountId: account.accountId,
      accountName: account.accountName,
      username: account.username,
      token: account.access_token ? decrypt(account.access_token) : null,
      refreshToken: account.refresh_token ? decrypt(account.refresh_token) : null,
      expiresAt: account.expires_at || null,
      isDefault: account.isDefault || false,
      connectedAt: account.connectedAt,
    };
  }

  // Legacy single-account format
  return {
    token: stored.token ? decrypt(stored.token) : null,
    refreshToken: stored.refreshToken ? decrypt(stored.refreshToken) : null,
    expiresAt: stored.expiresAt || null,
  };
}

/**
 * Get all accounts for a platform.
 *
 * @param {string} platform - Platform name
 * @returns {Array} Array of account objects
 */
function loadAllAccounts(platform) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return [];
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  if (!tokens[platform]) {
    return [];
  }

  const stored = tokens[platform];

  // Multi-account format
  if (stored.accounts && Array.isArray(stored.accounts)) {
    return stored.accounts.map(acc => ({
      accountId: acc.accountId,
      accountName: acc.accountName,
      username: acc.username,
      token: acc.access_token ? decrypt(acc.access_token) : null,
      refreshToken: acc.refresh_token ? decrypt(acc.refresh_token) : null,
      expiresAt: acc.expires_at || null,
      isDefault: acc.isDefault || false,
      connectedAt: acc.connectedAt,
    }));
  }

  // Legacy single-account format - convert to array
  if (stored.token) {
    return [{
      accountId: 'legacy',
      accountName: 'Default Account',
      username: 'legacy',
      token: stored.token ? decrypt(stored.token) : null,
      refreshToken: stored.refreshToken ? decrypt(stored.refreshToken) : null,
      expiresAt: stored.expiresAt || null,
      isDefault: true,
      connectedAt: new Date().toISOString(),
    }];
  }

  return [];
}

/**
 * Delete a token for a platform or specific account.
 *
 * @param {string} platform - Platform name
 * @param {string|null} accountId - Specific account ID (optional)
 * @returns {boolean} Success status
 */
function deleteToken(platform, accountId = null) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return false;
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  if (!tokens[platform]) {
    return false;
  }

  // Multi-account format
  if (tokens[platform].accounts && Array.isArray(tokens[platform].accounts)) {
    if (accountId) {
      // Delete specific account
      const initialLength = tokens[platform].accounts.length;
      tokens[platform].accounts = tokens[platform].accounts.filter(
        acc => acc.accountId !== accountId
      );

      // If we deleted the default account, make the first remaining account default
      if (tokens[platform].accounts.length > 0 && !tokens[platform].accounts.some(acc => acc.isDefault)) {
        tokens[platform].accounts[0].isDefault = true;
      }

      // If no accounts left, delete the platform entirely
      if (tokens[platform].accounts.length === 0) {
        delete tokens[platform];
      }

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      return initialLength > tokens[platform]?.accounts?.length || !tokens[platform];
    } else {
      // Delete all accounts for platform
      delete tokens[platform];
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      return true;
    }
  }

  // Legacy format - delete entire platform
  delete tokens[platform];
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return true;
}

/**
 * Set a specific account as the default for a platform.
 *
 * @param {string} platform - Platform name
 * @param {string} accountId - Account ID to set as default
 * @returns {boolean} Success status
 */
function setDefaultAccount(platform, accountId) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return false;
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  if (!tokens[platform] || !tokens[platform].accounts) {
    return false;
  }

  let found = false;
  tokens[platform].accounts.forEach(acc => {
    if (acc.accountId === accountId) {
      acc.isDefault = true;
      found = true;
    } else {
      acc.isDefault = false;
    }
  });

  if (found) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }
  return found;
}

module.exports = {
  saveToken,
  loadToken,
  loadAllAccounts,
  deleteToken,
  setDefaultAccount,
};
