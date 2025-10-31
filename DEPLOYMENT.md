# Deployment and Release Guide (Electron - cross-platform)

This document explains how to build distro-ready artifacts for Windows, macOS, and Linux using `electron-builder`.

Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- For macOS signing: Apple Developer account and certificates
- For Windows signing: Windows code signing certificate (PFX) and password

1) Prepare environment
- Create a local `.env` from `.env.example` with production secrets (don't commit `.env`).
- Ensure `ENCRYPTION_KEY` is set.

2) Install and build
```pwsh
npm ci
npm run build # if project has a build step; otherwise 'npm start' for dev
npm run dist
```

3) Configure signing
- macOS: configure `CSC_LINK` and `CSC_KEY_PASSWORD` as environment variables in CI or in local shell.
- Windows: pass PFX via `CSC_LINK` and `CSC_KEY_PASSWORD`.

4) CI recommendations
- Use GitHub Actions runner macOS-latest & windows-latest for signing and packaging.
- Store certificates as encrypted secrets in GitHub (do not store raw keys in repo).

5) Post-build
- Upload artifacts to Releases or distribution channels.
- Verify checksums and code-signing status.

Notes
- This repo uses `electron-builder` (see `package.json` scripts and `build` section).
- Signing is platform-specific and cannot be fully automated without provider credentials; use GitHub Secrets for CI.
