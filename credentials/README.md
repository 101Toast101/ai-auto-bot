# Credentials Folder

⚠️ **SECURITY NOTICE**: This folder contains sensitive credentials and secrets.

## Files in this folder:
- `client_secret_*.json` - Google OAuth credentials for YouTube API
- `Virtual box user name and PW.txt` - TikTok developer verification code

## Important:
- ✅ This folder is **ignored by git** (listed in `.gitignore`)
- ✅ Files here are **NEVER committed** to version control
- ✅ Each developer/user needs their own credentials
- ❌ **NEVER** share these files publicly or commit to GitHub

## For New Setup:
1. Get your own Google OAuth credentials from Google Cloud Console
2. Get your own TikTok developer verification from TikTok Developers
3. Place credential files in this folder
4. Reference them in your `.env` file if needed

## Current Protection:
- `.gitignore` blocks: `credentials/`, `client_secret_*.json`, `*.txt`
- Safe from accidental commits ✓
