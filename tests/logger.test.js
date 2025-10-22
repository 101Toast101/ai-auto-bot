// tests/logger.test.js - Tests for logger utilities

const { logInfo, logError } = require("../utils/logger.cjs");

// Mock console to capture output
let consoleLogSpy;
let consoleErrorSpy;

beforeEach(() => {
  consoleLogSpy = jest.spyOn(console, "warn").mockImplementation();
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

describe("logInfo", () => {
  test("logs info message to console", () => {
    logInfo("Test message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[INFO]");
    expect(consoleLogSpy.mock.calls[0][0]).toContain("Test message");
  });

  test("includes ISO timestamp", () => {
    logInfo("Test message");

    const logOutput = consoleLogSpy.mock.calls[0][0];

    // Should contain ISO 8601 timestamp
    expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("formats message with [INFO] prefix", () => {
    logInfo("Important information");

    const logOutput = consoleLogSpy.mock.calls[0][0];

    expect(logOutput).toContain("[INFO]");
    expect(logOutput).toContain("Important information");
  });

  test("handles empty string message", () => {
    logInfo("");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[INFO]");
  });

  test("handles special characters in message", () => {
    const specialMessage =
      "Message with \"quotes\" and 'apostrophes' and \n newlines";
    logInfo(specialMessage);

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toContain(specialMessage);
  });

  test("logs multiple messages separately", () => {
    logInfo("First message");
    logInfo("Second message");
    logInfo("Third message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy.mock.calls[0][0]).toContain("First message");
    expect(consoleLogSpy.mock.calls[1][0]).toContain("Second message");
    expect(consoleLogSpy.mock.calls[2][0]).toContain("Third message");
  });
});

describe("logError", () => {
  test("logs error message to console.error", () => {
    logError("Error occurred");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("[ERROR]");
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("Error occurred");
  });

  test("includes ISO timestamp", () => {
    logError("Error message");

    const logOutput = consoleErrorSpy.mock.calls[0][0];

    // Should contain ISO 8601 timestamp
    expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test("formats message with [ERROR] prefix", () => {
    logError("Critical error");

    const logOutput = consoleErrorSpy.mock.calls[0][0];

    expect(logOutput).toContain("[ERROR]");
    expect(logOutput).toContain("Critical error");
  });

  test("logs error object as second parameter", () => {
    const error = new Error("Test error");
    logError("Something went wrong", error);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("Something went wrong");
    expect(consoleErrorSpy.mock.calls[0][1]).toBe(error);
  });

  test("handles error without message", () => {
    logError("Error occurred", undefined);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("Error occurred");
  });

  test("handles various error types", () => {
    const syntaxError = new SyntaxError("Syntax error");
    const typeError = new TypeError("Type error");
    const customError = { message: "Custom error", code: 123 };

    logError("Syntax error occurred", syntaxError);
    logError("Type error occurred", typeError);
    logError("Custom error occurred", customError);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
  });

  test("logs multiple errors separately", () => {
    logError("First error");
    logError("Second error");
    logError("Third error");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("First error");
    expect(consoleErrorSpy.mock.calls[1][0]).toContain("Second error");
    expect(consoleErrorSpy.mock.calls[2][0]).toContain("Third error");
  });
});

describe("Logger Separation", () => {
  test("logInfo uses console.log, not console.error", () => {
    logInfo("Info message");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
  });

  test("logError uses console.error, not console.log", () => {
    logError("Error message");

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
  });

  test("mixed info and error logs use correct channels", () => {
    logInfo("Info 1");
    logError("Error 1");
    logInfo("Info 2");
    logError("Error 2");

    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("Timestamp Consistency", () => {
  test("timestamps are in ISO 8601 format", () => {
    logInfo("Test");

    const logOutput = consoleLogSpy.mock.calls[0][0];
    const timestampMatch = logOutput.match(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
    );

    expect(timestampMatch).not.toBeNull();
  });

  test("timestamps are recent", () => {
    const beforeLog = new Date();
    logInfo("Test");
    const afterLog = new Date();

    const logOutput = consoleLogSpy.mock.calls[0][0];
    const timestampMatch = logOutput.match(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
    );
    const logTimestamp = new Date(timestampMatch[0]);

    expect(logTimestamp.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
    expect(logTimestamp.getTime()).toBeLessThanOrEqual(afterLog.getTime());
  });
});

describe("Message Formatting", () => {
  test("messages maintain whitespace", () => {
    logInfo("  Message with  spaces  ");

    const logOutput = consoleLogSpy.mock.calls[0][0];
    expect(logOutput).toContain("  Message with  spaces  ");
  });

  test("messages with line breaks are preserved", () => {
    logInfo("Line 1\nLine 2\nLine 3");

    const logOutput = consoleLogSpy.mock.calls[0][0];
    expect(logOutput).toContain("Line 1\nLine 2\nLine 3");
  });

  test("messages with unicode characters work", () => {
    logInfo("Unicode: 🚀 ✅ 🎉");

    const logOutput = consoleLogSpy.mock.calls[0][0];
    expect(logOutput).toContain("Unicode: 🚀 ✅ 🎉");
  });
});
