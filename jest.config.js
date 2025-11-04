module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'utils/**/*.{js,cjs}',
    'tokenStore.cjs',
    '!utils/video-providers.js',
    '!utils/drag-drop.js',
    '!utils/keyboard-shortcuts.js',
    '!utils/toast.js',
    '!utils/accessibility.js', // DOM-dependent, tested in Electron environment
    '!**/node_modules/**',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
  ],
  silent: true, // Suppress console output during tests (logs still written to files in production)
};
