# Data Directory

This directory contains user-specific configuration and token files. **All files in this directory are gitignored** to prevent accidental leaking of sensitive credentials.

## Files

- `settings.json` - User settings and OAuth client credentials (encrypted)
- `tokens.json` - OAuth access tokens (encrypted)
- `savedConfigs.json` - Saved configuration presets
- `scheduledPosts.json` - Scheduled post queue
- `activity_log.json` - Application activity history
- `library.json` - Content library
- `.encryption_key` - Local encryption key (auto-generated)

## Setup

On first run, the application will automatically create these files with default values. See the `.example` files for structure reference.

## Security

- All API keys and tokens are encrypted using AES-256-GCM
- Encryption key is stored locally in `.encryption_key`
- Never commit actual data files to version control
- Use the `.example` files as templates only
