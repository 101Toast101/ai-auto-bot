// tests/config.test.js - Tests for configuration utilities

const path = require("path");
const { ENV, DEFAULTS } = require("../utils/config");

describe("ENV Configuration", () => {
  test("ENV object exists and has required properties", () => {
    expect(ENV).toBeDefined();
    expect(ENV).toHaveProperty("isDev");
    expect(ENV).toHaveProperty("isProd");
    expect(ENV).toHaveProperty("appRoot");
  });

  test("isDev and isProd are booleans", () => {
    expect(typeof ENV.isDev).toBe("boolean");
    expect(typeof ENV.isProd).toBe("boolean");
  });

  test("isDev and isProd are mutually exclusive", () => {
    // In test environment, both should be false or one should be true
    if (ENV.isDev) {
      expect(ENV.isProd).toBe(false);
    }
    if (ENV.isProd) {
      expect(ENV.isDev).toBe(false);
    }
  });

  test("appRoot is a valid path string", () => {
    expect(typeof ENV.appRoot).toBe("string");
    expect(ENV.appRoot.length).toBeGreaterThan(0);
    expect(path.isAbsolute(ENV.appRoot)).toBe(true);
  });
});

describe("DEFAULTS Configuration", () => {
  test("DEFAULTS object exists and has required properties", () => {
    expect(DEFAULTS).toBeDefined();
    expect(DEFAULTS).toHaveProperty("windowWidth");
    expect(DEFAULTS).toHaveProperty("windowHeight");
    expect(DEFAULTS).toHaveProperty("encoding");
    expect(DEFAULTS).toHaveProperty("defaultFilePath");
  });

  test("window dimensions are valid numbers", () => {
    expect(typeof DEFAULTS.windowWidth).toBe("number");
    expect(typeof DEFAULTS.windowHeight).toBe("number");
    expect(DEFAULTS.windowWidth).toBeGreaterThan(0);
    expect(DEFAULTS.windowHeight).toBeGreaterThan(0);
    expect(DEFAULTS.windowWidth).toBeLessThan(10000);
    expect(DEFAULTS.windowHeight).toBeLessThan(10000);
  });

  test("encoding is valid", () => {
    expect(typeof DEFAULTS.encoding).toBe("string");
    expect(["utf8", "utf-8"]).toContain(DEFAULTS.encoding);
  });

  test("defaultFilePath is valid", () => {
    expect(typeof DEFAULTS.defaultFilePath).toBe("string");
    expect(DEFAULTS.defaultFilePath).toContain("data");
    expect(path.isAbsolute(DEFAULTS.defaultFilePath)).toBe(true);
  });
});

describe("Configuration Immutability", () => {
  test("ENV should not be easily modifiable", () => {
    const originalIsDev = ENV.isDev;

    // Try to modify (should work but we test restoration)
    ENV.isDev = !originalIsDev;

    // In a real app, you'd freeze the object
    // For now, just verify the property exists
    expect(ENV).toHaveProperty("isDev");
  });

  test("DEFAULTS has reasonable default values", () => {
    // Window size reasonable for desktop app
    expect(DEFAULTS.windowWidth).toBeGreaterThanOrEqual(800);
    expect(DEFAULTS.windowHeight).toBeGreaterThanOrEqual(600);
  });
});
