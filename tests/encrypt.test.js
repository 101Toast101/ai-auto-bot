// tests/encrypt.test.js
const { encrypt, decrypt } = require("../utils/encrypt");

describe("Encryption Utilities", () => {
  test("encrypt should return a non-empty string", () => {
    const plaintext = "my-secret-api-key";
    const encrypted = encrypt(plaintext);

    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(":"); // Should have iv:authTag:data format
  });

  test("decrypt should return original text", () => {
    const plaintext = "my-secret-api-key";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test("encrypt empty string returns empty string", () => {
    const result = encrypt("");
    expect(result).toBe("");
  });

  test("decrypt empty string returns empty string", () => {
    const result = decrypt("");
    expect(result).toBe("");
  });

  test("decrypt non-encrypted data returns original data", () => {
    const result = decrypt("not-encrypted-data");
    expect(result).toBe("not-encrypted-data"); // Returns as-is if not encrypted format
  });

  test("different encryptions of same text are different", () => {
    const plaintext = "test-key";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    // Different IVs should make them different
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  test("handles null input gracefully", () => {
    expect(encrypt(null)).toBe("");
    expect(decrypt(null)).toBe("");
  });

  test("handles undefined input gracefully", () => {
    expect(encrypt(undefined)).toBe("");
    expect(decrypt(undefined)).toBe("");
  });

  test("handles malformed encrypted data", () => {
    // Invalid format (not enough parts)
    const result1 = decrypt("invalid:data");
    expect(typeof result1).toBe("string");
    
    // Invalid hex in IV - decrypt will fail gracefully
    const result2 = decrypt("ZZZZ:valid:data");
    expect(typeof result2).toBe("string");
  });

  test("encrypts and decrypts long strings", () => {
    const longText = "a".repeat(10000);
    const encrypted = encrypt(longText);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(longText);
  });

  test("encrypts and decrypts special characters", () => {
    const specialChars = "!@#$%^&*(){}[]|\\:;\"'<>,.?/~`";
    const encrypted = encrypt(specialChars);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(specialChars);
  });

  test("encrypts and decrypts unicode characters", () => {
    const unicode = "Hello 世界 🌍 مرحبا";
    const encrypted = encrypt(unicode);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(unicode);
  });

  test("encrypted data has correct format", () => {
    const plaintext = "test-data";
    const encrypted = encrypt(plaintext);
    
    // Format should be: iv:authTag:encryptedData
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    
    // IV should be 32 hex characters (16 bytes)
    expect(parts[0]).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(parts[0])).toBe(true);
    
    // Auth tag should be 32 hex characters (16 bytes)
    expect(parts[1]).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(parts[1])).toBe(true);
  });

  test("decrypt handles corrupted auth tag", () => {
    const plaintext = "test-data";
    const encrypted = encrypt(plaintext);
    
    // Corrupt the auth tag
    const parts = encrypted.split(":");
    parts[1] = "0".repeat(32); // Invalid auth tag
    const corrupted = parts.join(":");
    
    // Should return original corrupted string when decryption fails
    const result = decrypt(corrupted);
    // Verify it didn't crash and returned something
    expect(typeof result).toBe("string");
  });

  test("decrypt handles corrupted ciphertext", () => {
    const plaintext = "test-data";
    const encrypted = encrypt(plaintext);
    
    // Corrupt the ciphertext
    const parts = encrypted.split(":");
    parts[2] = parts[2].slice(0, -4) + "0000";
    const corrupted = parts.join(":");
    
    // Should return original corrupted string when decryption fails
    const result = decrypt(corrupted);
    // Verify it didn't crash and returned something
    expect(typeof result).toBe("string");
  });

  test("encrypts whitespace string (treated as content, not empty)", () => {
    // Whitespace is treated as actual content to encrypt
    const result1 = encrypt("   ");
    const result2 = encrypt("\n\t");
    
    // Should return encrypted strings (not empty)
    expect(result1).toBeTruthy();
    expect(result2).toBeTruthy();
    expect(result1).toContain(":");
    expect(result2).toContain(":");
  });

  test("encrypts and decrypts API key format strings", () => {
    const apiKey = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
    const encrypted = encrypt(apiKey);
    const decrypted = decrypt(encrypted);
    
    expect(encrypted).not.toBe(apiKey);
    expect(decrypted).toBe(apiKey);
  });

  test("encrypts and decrypts OAuth tokens", () => {
    const token = "ya29.a0AfH6SMBx..."; // OAuth token format
    const encrypted = encrypt(token);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(token);
  });
});
