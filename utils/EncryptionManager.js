// EncryptionManager.js - Enhanced encryption capabilities
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class EncryptionManager {
  constructor() {
    this.keyPairPath = path.join(process.cwd(), 'data', '.keypair');
    this.publicKey = null;
    this.privateKey = null;
  }

  async init() {
    try {
      await this.loadOrGenerateKeyPair();
    } catch (error) {
      console.error('Failed to initialize encryption manager:', error);
      throw error;
    }
  }

  async loadOrGenerateKeyPair() {
    try {
      // Try to load existing keypair
      const keyData = await fs.readFile(this.keyPairPath, 'utf8');
      const keys = JSON.parse(keyData);
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;
    } catch (error) {
      // Generate new keypair if none exists
      await this.generateAndSaveKeyPair();
    }
  }

  async generateAndSaveKeyPair() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, async (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }

        this.publicKey = publicKey;
        this.privateKey = privateKey;

        try {
          // Ensure data directory exists
          await fs.mkdir(path.dirname(this.keyPairPath), { recursive: true });

          // Save keypair
          await fs.writeFile(this.keyPairPath, JSON.stringify({
            publicKey,
            privateKey
          }, null, 2));

          // Set restrictive permissions
          await fs.chmod(this.keyPairPath, 0o600);

          resolve({ publicKey, privateKey });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async encryptSensitive(data) {
    if (!this.publicKey) {
      throw new Error('Encryption manager not initialized');
    }

    const buffer = Buffer.from(JSON.stringify(data));
    return crypto.publicEncrypt(this.publicKey, buffer).toString('base64');
  }

  async decryptSensitive(encryptedData) {
    if (!this.privateKey) {
      throw new Error('Encryption manager not initialized');
    }

    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = crypto.privateDecrypt(this.privateKey, buffer);
    return JSON.parse(decrypted.toString());
  }

  // Utility method to securely compare strings (timing attack safe)
  secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  }

  // Generate a secure random token
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data
  async hashSensitive(data, salt = null) {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        data,
        useSalt,
        100000,
        64,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          resolve({
            hash: derivedKey.toString('hex'),
            salt: useSalt
          });
        }
      );
    });
  }
}

module.exports = new EncryptionManager();
