// tokenStore.js - Secure token storage with encryption
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const TOKEN_PATH = "./data/tokens.json";
const IV_LENGTH = 16;

/**
 * Get or create a secure encryption key
 * Priority:
 * 1. Use ENCRYPTION_KEY from environment (production)
 * 2. Use persistent key from secure storage (development)
 * 3. Generate new key and store securely (first run)
 */
function getEncryptionKey() {
  // Production: Use environment variable
  if (process.env.ENCRYPTION_KEY) {
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey.length !== 64) {
      throw new Error(
        "ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
        "Generate with: node scripts/init-encryption.cjs"
      );
    }
    try {
      const key = Buffer.from(envKey, "hex");
      if (key.length !== 32) {
        throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
      }
      return key;
    } catch (err) {
      throw new Error(`Invalid ENCRYPTION_KEY: ${err.message}`);
    }
  }

  // Development: Use or create persistent key file
  const keyPath = path.join(__dirname, "data", ".encryption_key");

  try {
    const dataDir = path.dirname(keyPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Try to read existing key
    if (fs.existsSync(keyPath)) {
      const keyHex = fs.readFileSync(keyPath, "utf8").trim();
      if (keyHex.length === 64) {
        console.warn(
          "[TokenStore] Using development key from data/.encryption_key\n" +
          "⚠️  WARNING: For production, set ENCRYPTION_KEY environment variable"
        );
        return Buffer.from(keyHex, "hex");
      }
    }

    // Generate new secure random key
    console.warn(
      "[TokenStore] Generating new encryption key...\n" +
      "⚠️  IMPORTANT: Back up data/.encryption_key! If lost, tokens cannot be decrypted."
    );

    const newKey = crypto.randomBytes(32);
    const keyHex = newKey.toString("hex");

    // Write key file with restrictive permissions
    fs.writeFileSync(keyPath, keyHex, {
      encoding: "utf8",
      mode: 0o600 // Read/write for owner only
    });

    // Best-effort chmod (may fail on Windows)
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      console.warn("[TokenStore] Warning: Could not set restrictive file permissions (Windows?)");
    }

    return newKey;
  } catch (err) {
    throw new Error(`Failed to load/generate encryption key: ${err.message}`);
  }
}

// Initialize encryption key
const ENCRYPTION_KEY = getEncryptionKey();

// 🔐 Encrypt token
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

// 🔓 Decrypt token
function decrypt(text) {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// 💾 Save token with expiration
function saveToken(platform, token, expiresIn = null) {
  let tokens = {};
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    } catch (err) {
      console.error("[TokenStore] Error reading tokens file:", err.message);
      tokens = {};
    }
  }

  tokens[platform] = {
    token: encrypt(token),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
    updatedAt: Date.now(),
  };

  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
    console.warn(`[TokenStore] Token saved for ${platform}`);
  } catch (err) {
    console.error("[TokenStore] Error saving token:", err.message);
    throw err;
  }
}

// 📖 Get token (with expiration check)
function getToken(platform) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }

  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    const entry = tokens[platform];

    if (!entry) {
      return null;
    }

    // Check if token is expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      console.warn(`[TokenStore] Token for ${platform} has expired`);
      // Auto-delete expired token
      delete tokens[platform];
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
      return null;
    }

    return decrypt(entry.token);
  } catch (err) {
    console.error("[TokenStore] Error reading token:", err.message);
    return null;
  }
}

// 🗑️ Delete token
function deleteToken(platform) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return;
  }

  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    delete tokens[platform];
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
    console.warn(`[TokenStore] Token deleted for ${platform}`);
  } catch (err) {
    console.error("[TokenStore] Error deleting token:", err.message);
  }
}

module.exports = {
  saveToken,
  getToken,
  deleteToken,
  loadToken: getToken, // Alias for backward compatibility
  encrypt,
  decrypt,
};
