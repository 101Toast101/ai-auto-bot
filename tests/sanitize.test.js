// tests/sanitize.test.js
const {
  escapeHtml,
  sanitizeUrl,
  sanitizeFilename,
  limitLength,
  sanitizeObject,
} = require("../utils/sanitize");

describe("Sanitization Utilities", () => {
  describe("escapeHtml", () => {
    test("escapes HTML special characters", () => {
      const input = '<script>alert("XSS")</script>';
      const expected = "&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;";
      expect(escapeHtml(input)).toBe(expected);
    });

    test("escapes ampersands", () => {
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    test("escapes single quotes", () => {
      expect(escapeHtml("It's a test")).toBe("It&#039;s a test");
    });

    test("escapes double quotes", () => {
      expect(escapeHtml('Say "hello"')).toBe("Say &quot;hello&quot;");
    });

    test("escapes forward slashes", () => {
      expect(escapeHtml("path/to/file")).toBe("path&#x2F;to&#x2F;file");
    });

    test("handles non-string input", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
      expect(escapeHtml(123)).toBe("123");
      expect(escapeHtml(true)).toBe("true");
    });

    test("handles empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    test("handles complex XSS payload", () => {
      const xss = '<img src=x onerror="alert(\'XSS\')">';
      const result = escapeHtml(xss);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).not.toContain('"');
    });
  });

  describe("sanitizeUrl", () => {
    test("allows http URLs", () => {
      const url = "http://example.com/path";
      const result = sanitizeUrl(url);
      expect(result).toContain("http://example.com/path");
    });

    test("allows https URLs", () => {
      const url = "https://example.com/path";
      const result = sanitizeUrl(url);
      expect(result).toContain("https://example.com/path");
    });

    test("allows file URLs", () => {
      const url = "file:///C:/path/to/file.txt";
      expect(sanitizeUrl(url)).toBe(url);
    });

    test("blocks javascript: protocol", () => {
      const url = "javascript:alert('XSS')";
      expect(sanitizeUrl(url)).toBeNull();
    });

    test("blocks data: protocol", () => {
      const url = "data:text/html,<script>alert('XSS')</script>";
      expect(sanitizeUrl(url)).toBeNull();
    });

    test("blocks vbscript: protocol", () => {
      const url = "vbscript:msgbox('XSS')";
      expect(sanitizeUrl(url)).toBeNull();
    });

    test("handles invalid URLs", () => {
      expect(sanitizeUrl("not a url")).toBeNull();
      expect(sanitizeUrl("ht!tp://bad")).toBeNull();
    });

    test("handles null and undefined", () => {
      expect(sanitizeUrl(null)).toBeNull();
      expect(sanitizeUrl(undefined)).toBeNull();
      expect(sanitizeUrl("")).toBeNull();
    });

    test("handles custom allowed protocols", () => {
      const url = "ftp://example.com/file";
      const result = sanitizeUrl(url, ["ftp:"]);
      expect(result).toContain("ftp://example.com");
      expect(sanitizeUrl(url, ["http:", "https:"])).toBeNull();
    });

    test("preserves URL parameters", () => {
      const url = "https://example.com?param=value&foo=bar";
      const result = sanitizeUrl(url);
      expect(result).toContain("param=value");
      expect(result).toContain("foo=bar");
    });
  });

  describe("sanitizeFilename", () => {
    test("removes path separators", () => {
      expect(sanitizeFilename("path/to/file.txt")).toBe("path_to_file.txt");
      expect(sanitizeFilename("path\\to\\file.txt")).toBe("path_to_file.txt");
    });

    test("removes parent directory references", () => {
      const result = sanitizeFilename("../../../etc/passwd");
      expect(result).not.toContain("..");
      expect(result).toContain("_");
    });

    test("removes control characters", () => {
      const withControlChars = "file\x00name\x01test\x1F.txt";
      const result = sanitizeFilename(withControlChars);
      expect(result).toBe("file_name_test_.txt");
    });

    test("removes invalid Windows filename characters", () => {
      const invalid = 'file<name>test:file|name?.txt*"';
      const result = sanitizeFilename(invalid);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).not.toContain(":");
      expect(result).not.toContain("|");
      expect(result).not.toContain("?");
      expect(result).not.toContain("*");
      expect(result).not.toContain('"');
    });

    test("limits filename length to 255 characters", () => {
      const longName = "a".repeat(300);
      const result = sanitizeFilename(longName);
      expect(result.length).toBe(255);
    });

    test("handles null and undefined", () => {
      expect(sanitizeFilename(null)).toBe("untitled");
      expect(sanitizeFilename(undefined)).toBe("untitled");
      expect(sanitizeFilename("")).toBe("untitled");
    });

    test("preserves valid filename", () => {
      expect(sanitizeFilename("valid-file_name.txt")).toBe(
        "valid-file_name.txt",
      );
    });
  });

  describe("limitLength", () => {
    test("returns string unchanged when under limit", () => {
      const str = "hello world";
      expect(limitLength(str, 20)).toBe(str);
    });

    test("truncates string when over limit", () => {
      const str = "this is a very long string";
      const result = limitLength(str, 10);
      expect(result).toBe("this is a ");
      expect(result.length).toBe(10);
    });

    test("handles exact length match", () => {
      const str = "exactly10c";
      expect(limitLength(str, 10)).toBe(str);
    });

    test("handles non-string input", () => {
      expect(limitLength(null, 10)).toBe("");
      expect(limitLength(undefined, 10)).toBe("");
      expect(limitLength(123, 10)).toBe("");
    });

    test("uses custom default value", () => {
      expect(limitLength(null, 10, "default")).toBe("default");
      expect(limitLength(undefined, 10, "fallback")).toBe("fallback");
    });

    test("handles empty string", () => {
      expect(limitLength("", 10)).toBe("");
    });

    test("handles zero length limit", () => {
      expect(limitLength("hello", 0)).toBe("");
    });
  });

  describe("sanitizeObject", () => {
    test("removes __proto__ key", () => {
      const obj = { name: "test", __proto__: { polluted: true } };
      const result = sanitizeObject(obj);
      expect(result.name).toBe("test");
      expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(
        false,
      );
    });

    test("removes constructor key", () => {
      const obj = { name: "test", constructor: "bad" };
      const result = sanitizeObject(obj);
      expect(result.name).toBe("test");
      expect(Object.prototype.hasOwnProperty.call(result, "constructor")).toBe(
        false,
      );
    });

    test("removes prototype key", () => {
      const obj = { name: "test", prototype: "malicious" };
      const result = sanitizeObject(obj);
      expect(result).toHaveProperty("name", "test");
      expect(result).not.toHaveProperty("prototype");
    });

    test("preserves safe keys", () => {
      const obj = {
        name: "John",
        age: 30,
        email: "john@example.com",
        settings: { theme: "dark" },
      };
      const result = sanitizeObject(obj);
      expect(result).toEqual(obj);
    });

    test("handles null and undefined", () => {
      expect(sanitizeObject(null)).toEqual({});
      expect(sanitizeObject(undefined)).toEqual({});
    });

    test("handles non-object input", () => {
      expect(sanitizeObject("string")).toEqual({});
      expect(sanitizeObject(123)).toEqual({});
      expect(sanitizeObject(true)).toEqual({});
    });

    test("handles empty object", () => {
      expect(sanitizeObject({})).toEqual({});
    });

    test("prevents prototype pollution attack", () => {
      const malicious = JSON.parse(
        '{"name":"test","__proto__":{"isAdmin":true}}',
      );
      const result = sanitizeObject(malicious);
      expect(result.name).toBe("test");
      expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(
        false,
      );
    });
  });
});
