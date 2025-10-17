
class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class IPCError extends AppError {
  constructor(message) {
    super('IPC_ERROR', message);
    this.name = 'IPCError';
  }
}

class FileError extends AppError {
  constructor(message) {
    super('FILE_ERROR', message);
    this.name = 'FileError';
  }
}

module.exports = {
  AppError,
  IPCError,
  FileError,
};