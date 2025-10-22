// utils/encrypt.js - API Key Encryption
const crypto = require('crypto');
const os = require('os');
const path = require('path');

// Generate machine-specific encryption key
function getMachineKey() {
  const machineId = os.hostname() + os.platform() + os.arch();
  return crypto.createHash('sha256').update(machineId).digest();
}

const ALGORITHM = 'aes-256-gcm';
const KEY = getMachineKey();

function encrypt(text) {
  if (!text) return '';
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encryptedData
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData) {
  if (!encryptedData) return '';

  const parts = encryptedData.split(':');

  // Security: Validate encrypted data format
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format: expected format is iv:authTag:data');
  }

  // Validate hex encoding
  if (!/^[0-9a-f]+$/i.test(parts[0]) || !/^[0-9a-f]+$/i.test(parts[1]) || !/^[0-9a-f]+$/i.test(parts[2])) {
    throw new Error('Invalid encrypted data: data must be hex-encoded');
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    // Validate IV and authTag lengths
    if (iv.length !== 16) {
      throw new Error('Invalid IV length: expected 16 bytes');
    }
    if (authTag.length !== 16) {
      throw new Error('Invalid authentication tag length: expected 16 bytes');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Security: Throw error instead of returning empty string
    // This allows callers to detect tampering/corruption
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

module.exports = { encrypt, decrypt };