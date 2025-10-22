// tests/database.test.js
const database = require("../utils/database");
const fs = require("fs").promises;

// Mock fs module
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

describe("Database Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("readJson", () => {
    test("successfully reads and parses JSON file", async () => {
      const mockData = { test: "data", items: [1, 2, 3] };
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      const result = await database.readJson("test.json", {});

      expect(result.parsed).toEqual(mockData);
      expect(result.success).toBe(true);
    });

    test("returns fallback for non-existent file", async () => {
      const fallback = { default: "value" };
      fs.readFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));

      const result = await database.readJson("missing.json", fallback);

      expect(result.parsed).toEqual(fallback);
      expect(result.success).toBe(false);
    });

    test("handles malformed JSON gracefully", async () => {
      const fallback = { default: "value" };
      fs.readFile.mockResolvedValueOnce("{ invalid json }");

      const result = await database.readJson("malformed.json", fallback);

      expect(result.parsed).toEqual(fallback);
      expect(result.success).toBe(false);
    });
  });

  describe("writeJson", () => {
    test("successfully writes JSON with formatting", async () => {
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();
      const data = { test: "data", nested: { value: 123 } };

      const result = await database.writeJson("test.json", data);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("test.json"),
        JSON.stringify(data, null, 2),
        "utf8",
      );
    });

    test("handles write error gracefully", async () => {
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockRejectedValueOnce(new Error("Permission denied"));

      const result = await database.writeJson("test.json", {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("readSettings", () => {
    test("reads settings from settings.json", async () => {
      const mockSettings = { apiKey: "test-key" };
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockSettings));

      const result = await database.readSettings();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSettings);
    });

    test("returns empty object when settings.json missing", async () => {
      fs.readFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await database.readSettings();

      expect(result.success).toBe(false);
      expect(result.data).toEqual({});
    });
  });

  describe("writeSettings", () => {
    test("writes settings to settings.json", async () => {
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();
      const settings = { apiKey: "new-key" };

      const result = await database.writeSettings(settings);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("settings.json"),
        JSON.stringify(settings, null, 2),
        "utf8",
      );
    });
  });

  describe("readSavedConfigs", () => {
    test("reads saved configs", async () => {
      const mockConfigs = [{ name: "config1" }];
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfigs));

      const result = await database.readSavedConfigs();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockConfigs);
    });
  });

  describe("writeSavedConfigs", () => {
    test("writes saved configs", async () => {
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();
      const configs = [{ name: "config1" }];

      const result = await database.writeSavedConfigs(configs);

      expect(result.success).toBe(true);
    });
  });

  describe("readScheduledPosts", () => {
    test("reads scheduled posts", async () => {
      const mockPosts = [{ id: "post1" }];
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockPosts));

      const result = await database.readScheduledPosts();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPosts);
    });
  });

  describe("writeScheduledPosts", () => {
    test("writes scheduled posts", async () => {
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();
      const posts = [{ id: "post1" }];

      const result = await database.writeScheduledPosts(posts);

      expect(result.success).toBe(true);
    });
  });

  describe("readActivityLog", () => {
    test("reads activity log", async () => {
      const mockLogs = [{ action: "test" }];
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockLogs));

      const result = await database.readActivityLog();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLogs);
    });
  });

  describe("appendActivityLog", () => {
    test("appends entry to activity log", async () => {
      const existingLogs = [{ action: "old" }];
      fs.readFile.mockResolvedValueOnce(JSON.stringify(existingLogs));
      fs.mkdir.mockResolvedValueOnce();
      fs.writeFile.mockResolvedValueOnce();

      const newEntry = { action: "new" };
      const result = await database.appendActivityLog(newEntry);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("activity_log.json"),
        JSON.stringify([newEntry, { action: "old" }], null, 2),
        "utf8",
      );
    });
  });
});
