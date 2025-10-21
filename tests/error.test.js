// tests/error.test.js - Tests for custom error classes

const { AppError, IPCError, FileError } = require('../utils/error');

describe('AppError', () => {
  test('creates an error with code and message', () => {
    const error = new AppError('TEST_CODE', 'Test message');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('AppError');
  });

  test('captures stack trace', () => {
    const error = new AppError('TEST_CODE', 'Test message');

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('AppError');
  });

  test('is throwable and catchable', () => {
    expect(() => {
      throw new AppError('TEST_CODE', 'Test message');
    }).toThrow(AppError);

    try {
      throw new AppError('TEST_CODE', 'Test message');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('Test message');
    }
  });

  test('different instances have different stack traces', () => {
    const error1 = new AppError('CODE1', 'Message 1');
    const error2 = new AppError('CODE2', 'Message 2');

    // Stack traces should be different (created at different locations)
    expect(error1.stack).not.toBe(error2.stack);
  });
});

describe('IPCError', () => {
  test('extends AppError', () => {
    const error = new IPCError('IPC communication failed');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(IPCError);
  });

  test('has correct code and name', () => {
    const error = new IPCError('IPC communication failed');

    expect(error.code).toBe('IPC_ERROR');
    expect(error.name).toBe('IPCError');
    expect(error.message).toBe('IPC communication failed');
  });

  test('is distinguishable from other errors', () => {
    const ipcError = new IPCError('IPC failed');

    expect(ipcError).toBeInstanceOf(IPCError);
  const error = new AppError('TEST_CODE', 'Test message');
  expect(error).not.toBeInstanceOf(IPCError);
  });
});

describe('FileError', () => {
  test('extends AppError', () => {
    const error = new FileError('File not found');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(FileError);
  });

  test('has correct code and name', () => {
    const error = new FileError('File not found');

    expect(error.code).toBe('FILE_ERROR');
    expect(error.name).toBe('FileError');
    expect(error.message).toBe('File not found');
  });

  test('is distinguishable from other errors', () => {
    const fileError = new FileError('File error');
    const ipcError = new IPCError('IPC error');

    expect(fileError).toBeInstanceOf(FileError);
    expect(fileError).not.toBeInstanceOf(IPCError);
    expect(ipcError).not.toBeInstanceOf(FileError);
  });
});

describe('Error Hierarchy', () => {
  test('all custom errors are instances of Error', () => {
    const appError = new AppError('CODE', 'Message');
    const ipcError = new IPCError('IPC Message');
    const fileError = new FileError('File Message');

    expect(appError).toBeInstanceOf(Error);
    expect(ipcError).toBeInstanceOf(Error);
    expect(fileError).toBeInstanceOf(Error);
  });

  test('specific errors are instances of AppError', () => {
    const ipcError = new IPCError('IPC Message');
    const fileError = new FileError('File Message');

    expect(ipcError).toBeInstanceOf(AppError);
    expect(fileError).toBeInstanceOf(AppError);
  });

  test('can catch by specific error type', () => {
    try {
      throw new IPCError('Test IPC error');
    } catch (err) {
      if (err instanceof IPCError) {
        expect(err.code).toBe('IPC_ERROR');
      } else {
        throw new Error('Should have caught IPCError');
      }
    }
  });

  test('can catch by parent type', () => {
    try {
      throw new FileError('Test file error');
    } catch (err) {
      if (err instanceof AppError) {
        expect(err).toBeInstanceOf(FileError);
        expect(err.code).toBe('FILE_ERROR');
      } else {
        throw new Error('Should have caught as AppError');
      }
    }
  });
});

describe('Error Messages', () => {
  test('preserves custom error messages', () => {
    const customMessage = 'This is a very specific error message';
    const error = new AppError('CUSTOM', customMessage);

    expect(error.message).toBe(customMessage);
  });

  test('handles empty messages', () => {
    const error = new AppError('CODE', '');

    expect(error.message).toBe('');
    expect(error.code).toBe('CODE');
  });

  test('handles special characters in messages', () => {
    const specialMessage = 'Error: "quote" and \'apostrophe\' and \n newline';
    const error = new AppError('SPECIAL', specialMessage);

    expect(error.message).toBe(specialMessage);
  });
});
