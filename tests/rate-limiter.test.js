// tests/rate-limiter.test.js
const { RateLimiter, createRateLimitedHandler } = require("../utils/rate-limiter");

describe("RateLimiter", () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000, // 1 second for faster testing
    });
  });

  afterEach(() => {
    // Clear any intervals
    if (limiter) {
      limiter.cleanup();
    }
  });

  describe("checkLimit", () => {
    test("allows requests under the limit", () => {
      expect(limiter.checkLimit("user1", "channel1")).toBe(true);
      expect(limiter.checkLimit("user1", "channel1")).toBe(true);
      expect(limiter.checkLimit("user1", "channel1")).toBe(true);
    });

    test("blocks requests over the limit", () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        expect(limiter.checkLimit("user1", "channel1")).toBe(true);
      }
      // 6th request should be blocked
      expect(limiter.checkLimit("user1", "channel1")).toBe(false);
    });

    test("tracks different users independently", () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.checkLimit("user1", "channel1")).toBe(true);
      }
      expect(limiter.checkLimit("user1", "channel1")).toBe(false);

      // user2 should have fresh limit
      expect(limiter.checkLimit("user2", "channel1")).toBe(true);
    });

    test("tracks different channels independently", () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.checkLimit("user1", "channel1")).toBe(true);
      }
      expect(limiter.checkLimit("user1", "channel1")).toBe(false);

      // Different channel should have fresh limit
      expect(limiter.checkLimit("user1", "channel2")).toBe(true);
    });

    test("resets after time window expires", async () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit("user1", "channel1");
      }
      expect(limiter.checkLimit("user1", "channel1")).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should allow requests again
      expect(limiter.checkLimit("user1", "channel1")).toBe(true);
    });
  });

  describe("getCount", () => {
    test("returns current request count", () => {
      expect(limiter.getCount("user1", "channel1")).toBe(0);

      limiter.checkLimit("user1", "channel1");
      expect(limiter.getCount("user1", "channel1")).toBe(1);

      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user1", "channel1");
      expect(limiter.getCount("user1", "channel1")).toBe(3);
    });

    test("returns 0 for unknown sender/channel", () => {
      expect(limiter.getCount("unknown", "channel")).toBe(0);
    });

    test("excludes expired timestamps", async () => {
      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user1", "channel1");
      expect(limiter.getCount("user1", "channel1")).toBe(2);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(limiter.getCount("user1", "channel1")).toBe(0);
    });
  });

  describe("reset", () => {
    test("resets specific channel for user", () => {
      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user1", "channel2");

      expect(limiter.getCount("user1", "channel1")).toBe(2);
      expect(limiter.getCount("user1", "channel2")).toBe(1);

      limiter.reset("user1", "channel1");

      expect(limiter.getCount("user1", "channel1")).toBe(0);
      expect(limiter.getCount("user1", "channel2")).toBe(1);
    });

    test("resets all channels for user when channel not specified", () => {
      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user1", "channel2");
      limiter.checkLimit("user1", "channel3");

      expect(limiter.getCount("user1", "channel1")).toBe(1);
      expect(limiter.getCount("user1", "channel2")).toBe(1);

      limiter.reset("user1");

      expect(limiter.getCount("user1", "channel1")).toBe(0);
      expect(limiter.getCount("user1", "channel2")).toBe(0);
      expect(limiter.getCount("user1", "channel3")).toBe(0);
    });

    test("does not affect other users", () => {
      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user2", "channel1");

      limiter.reset("user1");

      expect(limiter.getCount("user1", "channel1")).toBe(0);
      expect(limiter.getCount("user2", "channel1")).toBe(1);
    });
  });

  describe("cleanup", () => {
    test("removes expired entries", async () => {
      limiter.checkLimit("user1", "channel1");
      limiter.checkLimit("user2", "channel2");

      expect(limiter.requests.size).toBeGreaterThan(0);

      // Wait for entries to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      limiter.cleanup();

      // Entries should be cleaned up
      expect(limiter.requests.size).toBe(0);
    });

    test("keeps non-expired entries", async () => {
      limiter.checkLimit("user1", "channel1");

      await new Promise((resolve) => setTimeout(resolve, 500));

      limiter.checkLimit("user2", "channel2");

      limiter.cleanup();

      // Recent entry should remain
      expect(limiter.getCount("user2", "channel2")).toBeGreaterThan(0);
    });
  });

  describe("createRateLimitedHandler", () => {
    test("calls handler when under rate limit", async () => {
      const mockHandler = jest.fn(() => ({ success: true, data: "test" }));
      const rateLimited = createRateLimitedHandler(limiter, mockHandler, {
        channel: "test-channel",
      });

      const mockEvent = { sender: { id: "user1" } };
      const result = await rateLimited(mockEvent, "arg1", "arg2");

      expect(mockHandler).toHaveBeenCalledWith(mockEvent, "arg1", "arg2");
      expect(result).toEqual({ success: true, data: "test" });
    });

    test("blocks handler when rate limit exceeded", async () => {
      const mockHandler = jest.fn(() => ({ success: true }));
      const rateLimited = createRateLimitedHandler(limiter, mockHandler, {
        channel: "test-channel",
      });

      const mockEvent = { sender: { id: "user1" } };

      // Fill up rate limit
      for (let i = 0; i < 5; i++) {
        await rateLimited(mockEvent);
      }

      // Next call should be blocked
      const result = await rateLimited(mockEvent);

      expect(result).toEqual({
        success: false,
        error: {
          message: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
        },
      });
      expect(mockHandler).toHaveBeenCalledTimes(5); // Not called for 6th request
    });

    test("handles handler errors gracefully", async () => {
      const mockHandler = jest.fn(() => {
        throw new Error("Handler error");
      });
      const rateLimited = createRateLimitedHandler(limiter, mockHandler, {
        channel: "test-channel",
      });

      const mockEvent = { sender: { id: "user1" } };
      const result = await rateLimited(mockEvent);

      expect(result).toEqual({
        success: false,
        error: { message: "Handler error" },
      });
    });

    test("uses default channel name when not specified", async () => {
      const mockHandler = jest.fn(() => ({ success: true }));
      const rateLimited = createRateLimitedHandler(limiter, mockHandler);

      const mockEvent = { sender: { id: "user1" } };
      await rateLimited(mockEvent);

      expect(limiter.getCount("user1", "unknown")).toBe(1);
    });
  });
});
