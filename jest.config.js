// jest.config.js - Jest Testing Configuration
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
  ],

  // Coverage configuration
  collectCoverage: false, // Set to true for coverage reports
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'utils/**/*.js',
    'handlers/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
  ],

  // Coverage thresholds (enforce quality standards)
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },

  // Module paths
  moduleDirectories: ['node_modules', '.'],

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup files (if needed)
  // setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
