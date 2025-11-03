// tests/AuthManager.test.js
const AuthManager = require("../utils/AuthManager");
const { saveToken, loadToken } = require("../tokenStore");

// Mock tokenStore
jest.mock("../tokenStore", () => ({
  saveToken: jest.fn(),
  loadToken: jest.fn(),
}));

describe("AuthManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateToken", () => {
    test("returns false for null or undefined token", () => {
      expect(AuthManager.validateToken(null)).toBe(false);
      expect(AuthManager.validateToken(undefined)).toBe(false);
      expect(AuthManager.validateToken("")).toBe(false);
    });

    test("returns false for malformed token", () => {
      expect(AuthManager.validateToken("not-a-token")).toBe(false);
      expect(AuthManager.validateToken("only.two.parts")).toBe(false);
    });

    test("validates token structure with three parts", () => {
      // Create a simple base64 token structure (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
        "base64",
      );
      const payload = Buffer.from(JSON.stringify({ sub: "123" })).toString(
        "base64",
      );
      const signature = "fake-signature";
      const token = Buffer.from(`${header}.${payload}.${signature}`).toString(
        "base64",
      );

      expect(AuthManager.validateToken(token)).toBe(true);
    });

    test("validates token expiration when exp claim present", () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
        "base64",
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: "123", exp: futureExp }),
      ).toString("base64");
      const signature = "fake-signature";
      const token = Buffer.from(`${header}.${payload}.${signature}`).toString(
        "base64",
      );

      expect(AuthManager.validateToken(token)).toBe(true);
    });

    test("rejects expired token", () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
        "base64",
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: "123", exp: pastExp }),
      ).toString("base64");
      const signature = "fake-signature";
      const token = Buffer.from(`${header}.${payload}.${signature}`).toString(
        "base64",
      );

      expect(AuthManager.validateToken(token)).toBe(false);
    });
  });

  describe("checkRateLimit", () => {
    test("allows requests under rate limit", () => {
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(true);
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(true);
    });

    test("blocks requests when rate limit exceeded", () => {
      // Instagram post limit is 25
      for (let i = 0; i < 25; i++) {
        AuthManager.checkRateLimit("instagram", "post");
      }
      // 26th request should be blocked
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(false);
    });

    test("tracks different platforms independently", () => {
      for (let i = 0; i < 25; i++) {
        AuthManager.checkRateLimit("instagram", "post");
      }
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(false);

      // TikTok should have fresh limit
      expect(AuthManager.checkRateLimit("tiktok", "post")).toBe(true);
    });

    test("tracks different operations independently", () => {
      for (let i = 0; i < 25; i++) {
        AuthManager.checkRateLimit("instagram", "post");
      }
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(false);

      // Read operation should have different limit
      expect(AuthManager.checkRateLimit("instagram", "read")).toBe(true);
    });

    test("resets count after time window", () => {
      jest.useFakeTimers();

      for (let i = 0; i < 25; i++) {
        AuthManager.checkRateLimit("instagram", "post");
      }
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(false);

      // Advance time by 1 hour + 1ms
      jest.advanceTimersByTime(3600001);

      // Should allow requests again
      expect(AuthManager.checkRateLimit("instagram", "post")).toBe(true);

      jest.useRealTimers();
    });
  });

  describe("getRateLimit", () => {
    test("returns correct limits for Instagram", () => {
      expect(AuthManager.getRateLimit("instagram", "post")).toBe(25);
      expect(AuthManager.getRateLimit("instagram", "read")).toBe(200);
    });

    test("returns correct limits for TikTok", () => {
      expect(AuthManager.getRateLimit("tiktok", "post")).toBe(50);
      expect(AuthManager.getRateLimit("tiktok", "read")).toBe(500);
    });

    test("returns correct limits for YouTube", () => {
      expect(AuthManager.getRateLimit("youtube", "post")).toBe(10);
      expect(AuthManager.getRateLimit("youtube", "read")).toBe(100);
    });

    test("returns correct limits for Twitter", () => {
      expect(AuthManager.getRateLimit("twitter", "post")).toBe(300);
      expect(AuthManager.getRateLimit("twitter", "read")).toBe(1000);
    });

    test("returns default limit for unknown platform", () => {
      expect(AuthManager.getRateLimit("unknown", "post")).toBe(100);
    });

    test("returns default limit for unknown operation", () => {
      expect(AuthManager.getRateLimit("instagram", "unknown")).toBe(100);
    });
  });

  describe("refreshToken", () => {
    test("throws error when no token found", async () => {
      loadToken.mockReturnValue(null);

      await expect(AuthManager.refreshToken("instagram")).rejects.toThrow(
        "No token found for instagram",
      );
    });

    test("throws error for unknown platform", async () => {
      loadToken.mockReturnValue("existing-token");

      await expect(AuthManager.refreshToken("unknown")).rejects.toThrow(
        "Unknown platform: unknown",
      );
    });

    test("prevents concurrent refresh for same platform", async () => {
      loadToken.mockReturnValue("existing-token");

      // Mock refresh method to delay
      const originalRefresh = AuthManager.refreshInstagramToken;
      AuthManager.refreshInstagramToken = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve("new-token"), 100)),
      );

      // Start two refresh operations
      const promise1 = AuthManager.refreshToken("instagram");
      const promise2 = AuthManager.refreshToken("instagram");

      await Promise.all([promise1, promise2]);

      // Should only refresh once
      expect(AuthManager.refreshInstagramToken).toHaveBeenCalledTimes(1);

      // Restore original
      AuthManager.refreshInstagramToken = originalRefresh;
    });

    test("calls platform-specific refresh method", async () => {
      loadToken.mockReturnValue("old-token");

      // Test Instagram
      const originalInstagram = AuthManager.refreshInstagramToken;
      AuthManager.refreshInstagramToken = jest.fn(() =>
        Promise.resolve("new-instagram-token"),
      );

      await AuthManager.refreshToken("instagram");
      expect(AuthManager.refreshInstagramToken).toHaveBeenCalled();

      // Restore
      AuthManager.refreshInstagramToken = originalInstagram;
    });

    test("saves new token after successful refresh", async () => {
      loadToken.mockReturnValue("old-token");

      // Mock refresh method
      const original = AuthManager.refreshInstagramToken;
      AuthManager.refreshInstagramToken = jest.fn(() =>
        Promise.resolve("new-token"),
      );

      await AuthManager.refreshToken("instagram");

      expect(saveToken).toHaveBeenCalledWith("instagram", "new-token");

      // Restore
      AuthManager.refreshInstagramToken = original;
    });

    test("clears refresh queue after completion", async () => {
      loadToken.mockReturnValue("old-token");

      // Mock refresh method
      const original = AuthManager.refreshInstagramToken;
      AuthManager.refreshInstagramToken = jest.fn(() =>
        Promise.resolve("new-token"),
      );

      expect(AuthManager.tokenRefreshQueue.has("instagram")).toBe(false);

      await AuthManager.refreshToken("instagram");

      expect(AuthManager.tokenRefreshQueue.has("instagram")).toBe(false);

      // Restore
      AuthManager.refreshInstagramToken = original;
    });

    test("clears refresh queue even on error", async () => {
      loadToken.mockReturnValue("old-token");

      // Mock refresh method to fail
      const original = AuthManager.refreshInstagramToken;
      AuthManager.refreshInstagramToken = jest.fn(() =>
        Promise.reject(new Error("Refresh failed")),
      );

      await expect(AuthManager.refreshToken("instagram")).rejects.toThrow(
        "Refresh failed",
      );

      expect(AuthManager.tokenRefreshQueue.has("instagram")).toBe(false);

      // Restore
      AuthManager.refreshInstagramToken = original;
    });
  });

  describe("refreshIntervals", () => {
    test("has correct intervals defined", () => {
      expect(AuthManager.refreshIntervals.instagram).toBe(60 * 24 * 60 * 1000); // 60 days
      expect(AuthManager.refreshIntervals.youtube).toBe(60 * 60 * 1000); // 1 hour
      expect(AuthManager.refreshIntervals.tiktok).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(AuthManager.refreshIntervals.twitter).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });
  });
});
