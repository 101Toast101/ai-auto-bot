<!-- .github/copilot-instructions.md -->
# Copilot / AI assistant instructions — AI Auto Bot

This file contains concise, actionable guidance for AI coding agents working on this Electron-based desktop app.

1. Big picture
   - This is an Electron app with three tiers: `main` (Node/Electron), `preload` (secure IPC bridge), and `renderer` (browser UI). Key files: `main.js`, `preload.js`, `renderer.js`.
   - Persistent state is stored as JSON files under `data/` (created automatically by `main.js`): `settings.json`, `savedConfigs.json`, `scheduledPosts.json`, `activity_log.json`, `library.json`.
   - Background scheduler runs in `main.js` (function `startScheduler`) and polls every 60s. Scheduled posts are sent to renderer via `EXECUTE_SCHEDULED_POST` IPC.

2. IPC & security patterns (critical)
   - All renderer ⇄ main comms go through the preload bridge exposed on `window.api` (see `preload.js`). Use these methods: `readFile`, `writeFile`, `encrypt`, `decrypt`, `startOAuth`, `onScheduledPost`, `onOAuthToken`.
   - IPC channel constants live in `utils/ipc.js` (e.g. `READ_FILE`, `WRITE_FILE`, `ENCRYPT_DATA`, `DECRYPT_DATA`) — prefer those constants when editing both sides.
   - `main.js` validates JSON on `WRITE_FILE` using validators (see `utils/validators.js` and the `getValidatorForFile` mapping in `main.js`). Do not bypass validation: always send well-formed JSON.
   - Sensitive fields (e.g. `apiKey`, `instagramToken`, `tiktokToken`, `youtubeToken`, `twitterToken`) are encrypted/decrypted through `window.api.encrypt` / `window.api.decrypt` in the renderer (`renderer.js` lists `SENSITIVE_FIELDS`). Follow that pattern.

3. Data and encryption
   - Local tokens may also be handled by `tokenStore.js` which expects an `ENCRYPTION_KEY` in environment (`.env`) and uses AES. When adding token code, respect the existing encryption format and `.env` usage.
   - NEVER commit `.env` file (it's in `.gitignore`). Use `.env.example` as a template but keep secrets out of version control.
   - `utils/database.js` provides helpers (`readJson`, `writeJson`, readSettings/writeSettings`) — prefer these for background Node-side data operations.
   - Sensitive files/directories excluded from git:
     - `.env` (encryption keys and secrets)
     - `data/` (user data and tokens)
     - `logs/` (may contain sensitive information)

4. Integration points & external deps
   - AI image generation and platform posting helpers are in `utils/api-manager.js` (OpenAI DALL‑E endpoints, Instagram/TikTok/YouTube/Twitter POST flows). Tokens are required and must be encrypted at rest.
   - OAuth flow is primarily handled in `main.js` (`start-oauth` handler) and `routes/auth.js` (express router stub). OAuth exchange in `main.js` contains placeholders for CLIENT_ID/SECRET — update carefully and prefer server-side exchanges when possible.

5. Developer workflows (how to run things)
   - Install deps: `npm install`
   - Run in development: `npm start` (starts Electron: script `start` in `package.json`).
   - Build distributables: `npm run dist` (uses `electron-builder`).
   - Run tests: `npm test` (Jest). Tests live in `tests/`.

6. Conventions & gotchas
   - Paths to JSON data are relative strings used across renderer and main (e.g. `'data/settings.json'`). Use the same relative paths to maintain compatibility with validation and scheduler.
   - `WRITE_FILE` in `main.js` expects a stringified JSON payload; if validation fails it returns `{ success: false, error: { message, details } }` — caller must handle and display messages (see `renderer.js` error handling via `displayValidationError`).
   - The renderer uses optimistic UI patterns (update UI and then persist). When modifying persistence behavior, ensure logs are appended via `addLogEntry` or `utils/database.appendActivityLog` to preserve audit trail.
   - The scheduler marks `post.posted = true` and writes back `scheduledPosts.json` after execution — avoid race conditions if multiple windows/processes manipulated the same file.
   - File Duplication Prevention:
     - Use provided deduplication helpers (e.g., `dedupeSavedConfigs`, `dedupeScheduledPosts`)
     - Always check for existing files before creation using `getValidatorForFile`
     - Ensure unique identifiers (timestamps, UUIDs) for new content
     - Use file validation to prevent duplicate IDs in collections
     - When creating new files, verify paths don't exist using `fs.exists`

7. Quick examples to follow
   - Read settings (renderer): `const r = await window.api.readFile('data/settings.json'); const settings = JSON.parse(r.content);`
   - Save settings (renderer): `const encrypted = await window.api.encrypt(settings.apiKey); await window.api.writeFile('data/settings.json', JSON.stringify(settings, null, 2));`
   - Handle scheduled post (main → renderer): `windows[0].webContents.send('EXECUTE_SCHEDULED_POST', post);`

8. When editing tests
   - Tests use Jest (see `jest.config.js`). Keep Node/Electron-specific APIs isolated or stubbed; prefer `utils/*` modules for pure JS logic to make unit testing straightforward.

9. Context Gathering Best Practices
   - Initial Workspace Understanding:
     - Use semantic search to get high-level view of relevant code
     - Use file search with patterns like `**/*.js` to find all JavaScript files
     - Use grep search with regex patterns to find related functionality across files

   - Deep Dive into Related Files:
     - Read ALL related files in parallel when working with features
     - For features affecting multiple tiers, check:
       - `renderer.js` (UI logic)
       - `styles.css` (styling)
       - `preload.js` (IPC bridge)
       - `main.js` (backend logic)
       - Relevant config/validator files

   - Dependency Chain Analysis:
     - Follow imports/requires to understand file relationships
     - Check all references to functions/variables
     - Verify IPC channels in both main and renderer processes

   - State Management Check:
     - Review all state storage files in `data/`
     - Check validator schemas before making changes
     - Verify IPC communication patterns

   - Test Coverage:
     - Read relevant test files in `tests/` directory
     - Ensure changes match existing test patterns

10. Development Standards & Quality Gates
    - Version Control:
      - Follow semantic versioning (MAJOR.MINOR.PATCH)
      - Branch naming: feature/*, bugfix/*, release/*
      - Require signed commits
      - PR template requirements in `.github/pull_request_template.md`

    - Code Quality Requirements:
      - 80% minimum test coverage
      - Zero security vulnerabilities (run `npm audit`)
      - ESLint compliance (configuration in `.eslintrc`)
      - TypeScript strict mode preferred
      - Documentation required for public APIs

    - Security Requirements:
      - Dependencies must be pinned to exact versions
      - Weekly security updates required
      - Input validation on all user-provided data
      - Regular security audits
      - OWASP compliance required

    - Performance Standards:
      - Maximum main thread blocking: 16ms
      - Maximum initial load time: 2s
      - Memory usage below 200MB
      - CPU usage below 15% idle

    - Release Process:
      - Staging environment testing required
      - Change log updates required
      - Version bump in package.json
      - Tag releases in git
      - Generate release notes

If anything in this file is unclear or you need more detail (e.g., validator schemas, encryption format, or OAuth CLIENT_ID placement), ask and I will expand specific sections.
