// ESLint v9+ flat config format
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.config.js",
      ".github/**",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
      },
    },
    rules: {
      // Security
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",

      // Best Practices
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],

      // Code Quality
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",

      // Node.js
      "no-path-concat": "error",
    },
  },
];
