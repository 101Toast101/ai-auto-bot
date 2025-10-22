// utils/encrypt.cjs - API Key Encryption
const crypto = require("crypto");
const os = require("os");

// Generate machine-specific encryption key
function getMachineKey() {
  const machineId = os.hostname() + os.platform() + os.arch();
  return crypto.createHash("sha256").update(machineId).digest();
}

const ALGORITHM = "aes-256-gcm";
const KEY = getMachineKey();

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
  } catch (err) {
    return encryptedData;
  }
}

module.exports = { encrypt, decrypt };
