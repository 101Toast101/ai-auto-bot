// tests/api-manager.test.js
const apiManager = require("../utils/api-manager");

describe("API Manager", () => {
  // Mock fetch globally
  global.fetch = jest.fn();

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("generateAIImage", () => {
    test("successfully generates image with valid API key", async () => {
      const mockResponse = {
        data: [{ url: "https://example.com/generated-image.png" }],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiManager.generateAIImage(
        "test-prompt",
        "test-api-key",
      );

      expect(result.success).toBe(true);
      expect(result.imageUrl).toBe("https://example.com/generated-image.png");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/images/generations",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        }),
      );
    });

    test("handles API error gracefully", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await apiManager.generateAIImage(
        "test-prompt",
        "invalid-key",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to generate image");
    });

    test("handles network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await apiManager.generateAIImage(
        "test-prompt",
        "test-key",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("postToInstagram", () => {
    test("successfully posts to Instagram", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "post-123" }),
      });

      const result = await apiManager.postToInstagram(
        "image-url",
        "Test caption",
        "test-token",
      );

      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-123");
    });

    test("handles missing token", async () => {
      const result = await apiManager.postToInstagram(
        "image-url",
        "caption",
        null,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Instagram token not provided");
    });

    test("handles API error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Invalid image URL" } }),
      });

      const result = await apiManager.postToInstagram(
        "bad-url",
        "caption",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Instagram post failed");
    });

    test("handles network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await apiManager.postToInstagram(
        "image-url",
        "caption",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network timeout");
    });
  });

  describe("postToTikTok", () => {
    test("successfully posts to TikTok", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ video_id: "video-456" }),
      });

      const result = await apiManager.postToTikTok(
        "video-url",
        "Test description",
        "test-token",
      );

      expect(result.success).toBe(true);
      expect(result.videoId).toBe("video-456");
    });

    test("handles API rate limit", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const result = await apiManager.postToTikTok(
        "video-url",
        "description",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("rate limit");
    });

    test("handles missing token", async () => {
      const result = await apiManager.postToTikTok(
        "video-url",
        "description",
        null,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("TikTok token not provided");
    });

    test("handles API error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid video format" }),
      });

      const result = await apiManager.postToTikTok(
        "bad-video",
        "description",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("TikTok post failed");
    });

    test("handles network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await apiManager.postToTikTok(
        "video-url",
        "description",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });
  });

  describe("postToYouTube", () => {
    test("successfully posts to YouTube", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "youtube-789" }),
      });

      const result = await apiManager.postToYouTube(
        "content-url",
        "Test title",
        "Test description",
        "test-token",
      );

      expect(result.success).toBe(true);
      expect(result.videoId).toBe("youtube-789");
    });

    test("handles missing token", async () => {
      const result = await apiManager.postToYouTube(
        "content-url",
        "title",
        "description",
        null,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("YouTube token not provided");
    });

    test("handles API error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Quota exceeded" } }),
      });

      const result = await apiManager.postToYouTube(
        "content-url",
        "title",
        "description",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("YouTube post failed");
    });

    test("handles network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("DNS lookup failed"));

      const result = await apiManager.postToYouTube(
        "content-url",
        "title",
        "description",
        "test-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("DNS lookup failed");
    });
  });

  describe("postToTwitter", () => {
    test("successfully posts to Twitter", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "tweet-101" } }),
      });

      const result = await apiManager.postToTwitter(
        "Test tweet content",
        "test-token",
      );

      expect(result.success).toBe(true);
      expect(result.tweetId).toBe("tweet-101");
    });

    test("handles character limit", async () => {
      const longText = "a".repeat(281); // Twitter limit is 280

      const result = await apiManager.postToTwitter(longText, "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds character limit");
    });

    test("handles missing token", async () => {
      const result = await apiManager.postToTwitter("tweet text", null);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Twitter token not provided");
    });

    test("handles API error response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ errors: [{ message: "Unauthorized" }] }),
      });

      const result = await apiManager.postToTwitter(
        "tweet text",
        "invalid-token",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Twitter post failed");
    });

    test("handles network error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Request timeout"));

      const result = await apiManager.postToTwitter("tweet text", "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Request timeout");
    });
  });
});
