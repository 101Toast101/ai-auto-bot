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
});
