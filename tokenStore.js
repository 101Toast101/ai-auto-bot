// tokenStore.js
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const TOKEN_PATH = './data/tokens.json';
const IV_LENGTH = 16;

// Load or derive encryption key
let ENCRYPTION_KEY_BUFFER = null;
if (process.env.ENCRYPTION_KEY) {
  try {
    const buf = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    if (buf.length !== 32) {
      console.warn('[tokenStore] ENCRYPTION_KEY provided but length != 32 bytes (hex). Falling back to ephemeral key.');
    } else {
      ENCRYPTION_KEY_BUFFER = buf;
    }
  } catch (e) {
    console.warn('[tokenStore] Invalid ENCRYPTION_KEY format. Expecting hex-encoded 32-byte key. Falling back to ephemeral key.');
  }
}

if (!ENCRYPTION_KEY_BUFFER) {
  // Generate a persistent key in data/.encryption_key so tokens survive restarts
  // in development. This file is created with restrictive permissions when possible.
  try {
    const dataDir = './data';
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const keyFile = './data/.encryption_key';
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, 'utf8').trim();
      if (existing && existing.length === 64) {
        ENCRYPTION_KEY_BUFFER = Buffer.from(existing, 'hex');
        console.warn('[tokenStore] Using existing key from data/.encryption_key (development mode).');
      }
    }

    if (!ENCRYPTION_KEY_BUFFER) {
      const generated = crypto.randomBytes(32);
      fs.writeFileSync(keyFile, generated.toString('hex'), { encoding: 'utf8', flag: 'w' });
      // Best-effort chmod (Windows may ignore)
      try { fs.chmodSync(keyFile, 0o600); } catch (e) {}
      ENCRYPTION_KEY_BUFFER = generated;
      console.warn('[tokenStore] Generated development key and saved to data/.encryption_key. DO NOT commit this file.');
    }
  } catch (e) {
    // Fallback to ephemeral in case of any IO error
    ENCRYPTION_KEY_BUFFER = crypto.randomBytes(32);
    console.warn('[tokenStore] Failed to persist key; using ephemeral key for this process. Error:', e.message);
  }
}

const ENCRYPTION_KEY = ENCRYPTION_KEY_BUFFER;

// 🔐 Encrypt token
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// 🔓 Decrypt token
function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 💾 Save token
function saveToken(platform, token) {
  let tokens = {};
  if (fs.existsSync(TOKEN_PATH)) {
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  }
  tokens[platform] = encrypt(token);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

// 📤 Load token
function loadToken(platform) {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
  if (!tokens[platform]) return null;
  return decrypt(tokens[platform]);
}

module.exports = {
  saveToken,
  loadToken,
};