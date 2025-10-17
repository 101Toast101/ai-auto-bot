
// ========================================
// utils/config.js
// ========================================
const path = require('path');

const ENV = {
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  appRoot: path.resolve(__dirname, '..'),
};

const DEFAULTS = {
  windowWidth: 1400,
  windowHeight: 900,
  encoding: 'utf8',
  defaultFilePath: path.join(ENV.appRoot, 'data', 'default.txt'),
};

module.exports = {
  ENV,
  DEFAULTS,
};