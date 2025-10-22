// eslint.config.js - ESLint v9 Flat Config
// Migrated from .eslintrc.json

const js = require('@eslint/js');
const globals = require('globals');

// TODO: Install and configure these plugins for full security coverage:
// npm install globals @eslint/js
// For security plugin: npm install @eslint-community/eslint-plugin-security-node
// const security = require('@eslint-community/eslint-plugin-security-node');
// const node = require('eslint-plugin-node');
// const jest = require('eslint-plugin-jest');

module.exports = [
  // Base recommended config
  js.configs.recommended,

  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
      },
    },

    rules: {
      // Security rules
      // Note: eslint-plugin-security requires special configuration in v9
      // These will need the plugin installed and configured separately

      // Best Practices
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-caller': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-extend-native': 'error',

      // Error Prevention
      'no-await-in-loop': 'warn',
      'no-template-curly-in-string': 'error',
      'require-atomic-updates': 'error',

      // Code Style
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'arrow-spacing': [
        'error',
        {
          before: true,
          after: true,
        },
      ],
      'block-spacing': ['error', 'always'],
      'camelcase': [
        'error',
        {
          properties: 'never',
        },
      ],
    },
  },

  // Test files configuration
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '*.min.js',
    ],
  },
];
