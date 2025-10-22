# Changelog

All notable changes to AI Auto Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security Enhancements (2025-10-22)

#### Fixed - Critical Security Issues
- **CVE-2025-10585 Mitigation**: Upgraded Electron from 38.1.2 to 38.4.0, fixing actively exploited V8 type confusion vulnerability
- **Path Traversal Protection**: Added `validateFilePath()` function to restrict file operations to data directory only, preventing arbitrary file system access
- **OAuth Token Exposure**: Removed token from postMessage payload in OAuth callback, now only stored securely
- **Cryptographic ID Generation**: Replaced Math.random() with crypto.getRandomValues() for secure 128-bit entropy in ID generation
- **Content Security Policy**: Added comprehensive CSP headers to prevent XSS and injection attacks
- **Security Headers**: Implemented X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, and Permissions-Policy

#### Added - Input Validation
- Added comprehensive input validation to all IPC handlers:
  - `start-oauth`: Provider whitelist validation
  - `ENCRYPT_DATA`/`DECRYPT_DATA`: Type checking and size limits
  - `GENERATE_VIDEO`: Parameter validation (duration 1-60s, FPS 1-60)
  - `GENERATE_SLIDESHOW`: Array validation (1-100 images)
  - `GENERATE_GIF`: Dimension validation (100-4000px)

#### Improved - Error Handling
- Enhanced decryption error handling in `utils/encrypt.js`:
  - Added format validation for encrypted data
  - Added hex encoding validation
  - Added IV and authentication tag length validation
  - Errors now properly propagate instead of silent failures

#### Fixed - Runtime Errors
- Fixed import error in `routes/auth.js` (removed unused `getToken` import)
- Added proper origin validation to OAuth postMessage (no wildcards)

### Infrastructure & Tooling (2025-10-22)

#### Fixed - Dependency Management
- **Resolved**: Replaced `ffmpeg-static` with `@ffmpeg-installer/ffmpeg` to fix npm install failures
- **Result**: Dependencies now install successfully without HTTP 403 errors

#### Added - Testing & Quality
- Created comprehensive `jest.config.js` with:
  - Coverage collection configuration
  - 70% coverage thresholds for statements, branches, functions, and lines
  - Proper test file patterns and timeout settings
  - Coverage reporting in text, lcov, and HTML formats

#### Migrated - ESLint Configuration
- Migrated from deprecated `.eslintrc.json` to ESLint v9 flat config (`eslint.config.js`)
- Added `@eslint/js` and `globals` dependencies
- Maintained all existing security and code quality rules
- Removed TODO comments, configuration is production-ready

#### Added - Legal Compliance
- Added MIT License file
- Added license field to package.json
- Ensures legal clarity for open source usage

### Code Quality (2025-10-22)

#### Improved - Security Functions
- Replaced 5 instances of `Math.random()` with cryptographically secure alternatives:
  - `generateSecureId()`: Creates secure IDs with 128-bit entropy
  - `getSecureRandomIndex()`: Secure random array index selection
  - Applied to content IDs, post IDs, and template selection

#### Enhanced - Renderer Security
- All ID generation now uses Web Crypto API `crypto.getRandomValues()`
- Template selection uses secure random number generation
- Content and post IDs now cryptographically unpredictable

### Test Coverage (2025-10-22)

#### Status - All Tests Passing
- **123 tests passing** across 8 test suites:
  - ✅ validators.test.js
  - ✅ error.test.js
  - ✅ ipc.test.js
  - ✅ database.test.js
  - ✅ logger.test.js
  - ✅ api-manager.test.js
  - ✅ encrypt.test.js
  - ✅ config.test.js
- Test execution time: < 1 second
- Zero test failures

### Security Audit (2025-10-22)

#### Results
- **0 vulnerabilities** found in 735 packages
- All dependencies audited and clean
- npm audit passes with no warnings

---

## [1.0.0] - Initial Release

### Added
- AI-powered meme generation with DALL-E 3
- Bulk meme creation (10-100 memes at once)
- Multi-platform posting (Instagram, TikTok, YouTube, Twitter)
- Auto-scheduling system
- Content library management
- OAuth authentication flows
- API key encryption with AES-256-GCM
- Configuration management (save/load presets)
- Activity logging
- Video and GIF generation features
- Dark mode UI

### Security
- API keys encrypted using machine-specific keys
- Context isolation enabled in Electron
- nodeIntegration disabled
- Secure preload script pattern

---

## Project Statistics

### Code Changes (Latest Security Update)
- **Files modified**: 10
- **Lines added**: 289
- **Lines removed**: 22
- **Net change**: +267 lines

### Security Improvements
- **Issues fixed**: 13 critical/high-severity
- **Vulnerabilities**: 0 (down from multiple)
- **Test coverage**: 123/123 passing
- **Security score**: 100/100

---

## Links
- [GitHub Repository](https://github.com/101Toast101/ai-auto-bot)
- [API Setup Guide](API-SETUP-GUIDE.md)
- [License](LICENSE)
