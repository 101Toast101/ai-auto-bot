// utils/encrypt.js - API Key Encryption (SECURE VERSION)
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ALGORITHM = "aes-256-gcm";

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
      return Buffer.from(envKey, "hex");
    } catch {
      throw new Error("ENCRYPTION_KEY is not valid hex format");
    }
  }

  // Development: Use or create persistent key file
  const keyPath = path.join(__dirname, "..", "data", ".encryption_key");

  try {
    // Try to read existing key
    if (fs.existsSync(keyPath)) {
      const keyHex = fs.readFileSync(keyPath, "utf8").trim();
      if (keyHex.length === 64) {
        console.warn(
          "[Encryption] Using development key from data/.encryption_key\n" +
          "⚠️  WARNING: For production, set ENCRYPTION_KEY environment variable"
        );
        return Buffer.from(keyHex, "hex");
      }
    }

    // Generate new secure random key
    console.warn(
      "[Encryption] Generating new encryption key...\n" +
      "This key will be saved to data/.encryption_key\n" +
      "⚠️  IMPORTANT: Back up this file! If lost, encrypted data cannot be recovered."
    );

    const newKey = crypto.randomBytes(32);
    const keyHex = newKey.toString("hex");

    // Ensure data directory exists
    const dataDir = path.dirname(keyPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write key file with restrictive permissions
    fs.writeFileSync(keyPath, keyHex, {
      encoding: "utf8",
      mode: 0o600 // Read/write for owner only
    });

    return newKey;
  } catch (err) {
    throw new Error(`Failed to load/generate encryption key: ${err.message}`);
  }
}

// Initialize key once
const KEY = getEncryptionKey();

function encrypt(text) {
  if (!text) {
    return "";
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encryptedData
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedData) {
  if (!encryptedData) {
    return "";
  }

  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      return encryptedData;
    } // Return as-is if not encrypted

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return "";
  }
}

module.exports = { encrypt, decrypt };
