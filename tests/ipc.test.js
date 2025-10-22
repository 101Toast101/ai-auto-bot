// tests/ipc.test.js - Tests for IPC channel management

const { IPC_CHANNELS, isValidChannel } = require("../utils/ipc");

describe("IPC_CHANNELS", () => {
  test("IPC_CHANNELS object exists", () => {
    expect(IPC_CHANNELS).toBeDefined();
    expect(typeof IPC_CHANNELS).toBe("object");
  });

  test("contains expected channel names", () => {
    expect(IPC_CHANNELS).toHaveProperty("READ_FILE");
    expect(IPC_CHANNELS).toHaveProperty("WRITE_FILE");
    expect(IPC_CHANNELS).toHaveProperty("ENCRYPT_DATA");
    expect(IPC_CHANNELS).toHaveProperty("DECRYPT_DATA");
    expect(IPC_CHANNELS).toHaveProperty("START_SCHEDULER");
  });

  test("channel values match their keys", () => {
    expect(IPC_CHANNELS.READ_FILE).toBe("READ_FILE");
    expect(IPC_CHANNELS.WRITE_FILE).toBe("WRITE_FILE");
    expect(IPC_CHANNELS.ENCRYPT_DATA).toBe("ENCRYPT_DATA");
    expect(IPC_CHANNELS.DECRYPT_DATA).toBe("DECRYPT_DATA");
    expect(IPC_CHANNELS.START_SCHEDULER).toBe("START_SCHEDULER");
  });

  test("all channel values are strings", () => {
    Object.values(IPC_CHANNELS).forEach((channel) => {
      expect(typeof channel).toBe("string");
      expect(channel.length).toBeGreaterThan(0);
    });
  });

  test("channel names are uppercase with underscores", () => {
    Object.values(IPC_CHANNELS).forEach((channel) => {
      expect(channel).toMatch(/^[A-Z_]+$/);
    });
  });

  test("no duplicate channel values", () => {
    const values = Object.values(IPC_CHANNELS);
    const uniqueValues = [...new Set(values)];
    expect(values.length).toBe(uniqueValues.length);
  });
});

describe("isValidChannel", () => {
  test("returns true for valid channels", () => {
    expect(isValidChannel("READ_FILE")).toBe(true);
    expect(isValidChannel("WRITE_FILE")).toBe(true);
    expect(isValidChannel("ENCRYPT_DATA")).toBe(true);
    expect(isValidChannel("DECRYPT_DATA")).toBe(true);
    expect(isValidChannel("START_SCHEDULER")).toBe(true);
  });

  test("returns false for invalid channels", () => {
    expect(isValidChannel("INVALID_CHANNEL")).toBe(false);
    expect(isValidChannel("random_channel")).toBe(false);
    expect(isValidChannel("DELETE_FILE")).toBe(false);
    expect(isValidChannel("")).toBe(false);
  });

  test("returns false for non-string inputs", () => {
    expect(isValidChannel(null)).toBe(false);
    expect(isValidChannel(undefined)).toBe(false);
    expect(isValidChannel(123)).toBe(false);
    expect(isValidChannel({})).toBe(false);
    expect(isValidChannel([])).toBe(false);
  });

  test("is case-sensitive", () => {
    expect(isValidChannel("READ_FILE")).toBe(true);
    expect(isValidChannel("read_file")).toBe(false);
    expect(isValidChannel("Read_File")).toBe(false);
  });

  test("validates all defined channels", () => {
    Object.values(IPC_CHANNELS).forEach((channel) => {
      expect(isValidChannel(channel)).toBe(true);
    });
  });
});

describe("IPC_CHANNELS usage in application", () => {
  test("can be used to build channel maps", () => {
    const handlers = {
      [IPC_CHANNELS.READ_FILE]: () => "read handler",
      [IPC_CHANNELS.WRITE_FILE]: () => "write handler",
      [IPC_CHANNELS.ENCRYPT_DATA]: () => "encrypt handler",
    };

    expect(handlers[IPC_CHANNELS.READ_FILE]()).toBe("read handler");
    expect(handlers[IPC_CHANNELS.WRITE_FILE]()).toBe("write handler");
    expect(handlers[IPC_CHANNELS.ENCRYPT_DATA]()).toBe("encrypt handler");
  });

  test("prevents typos in channel names", () => {
    // Using constant prevents typos
    const channel = IPC_CHANNELS.READ_FILE;
    expect(channel).toBe("READ_FILE");

    // Typo would cause error at compile time (if using TypeScript)
    // or runtime if accessed as property
  });

  test("provides autocomplete-friendly API", () => {
    // This test just verifies the structure supports IDE autocomplete
    expect(Object.keys(IPC_CHANNELS).length).toBeGreaterThan(0);

    // All keys should be valid identifiers
    Object.keys(IPC_CHANNELS).forEach((key) => {
      expect(key).toMatch(/^[A-Z_]+$/);
    });
  });
});

describe("Channel Security", () => {
  test("channel names do not contain sensitive information", () => {
    Object.values(IPC_CHANNELS).forEach((channel) => {
      const lowerChannel = channel.toLowerCase();

      // Should not contain passwords, keys, secrets
      expect(lowerChannel).not.toContain("password");
      expect(lowerChannel).not.toContain("key");
      expect(lowerChannel).not.toContain("secret");
      expect(lowerChannel).not.toContain("token");
    });
  });

  test("channel names are descriptive of action", () => {
    // Each channel should describe what it does
    expect(IPC_CHANNELS.READ_FILE).toContain("READ");
    expect(IPC_CHANNELS.WRITE_FILE).toContain("WRITE");
    expect(IPC_CHANNELS.ENCRYPT_DATA).toContain("ENCRYPT");
    expect(IPC_CHANNELS.DECRYPT_DATA).toContain("DECRYPT");
  });
});

describe("Channel Count", () => {
  test("has expected number of channels", () => {
    const channelCount = Object.keys(IPC_CHANNELS).length;

    // Should have at least the core channels
    expect(channelCount).toBeGreaterThanOrEqual(5);

    // Shouldn't have too many (indicates good API design)
    expect(channelCount).toBeLessThan(20);
  });
});
