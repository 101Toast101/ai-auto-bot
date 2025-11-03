# 🚨 URGENT: SECRET ROTATION REQUIRED

**Date**: November 1, 2025
**Priority**: CRITICAL - Complete within 24 hours

## ⚠️ WHY THIS IS CRITICAL

A security audit found that your `.env` file exists locally with potentially exposed credentials. Even though it's not currently tracked in git, all secrets should be rotated as a precaution.

## 🔄 SECRETS TO ROTATE IMMEDIATELY

### 1. Instagram OAuth Credentials
- [ ] Go to https://developers.facebook.com/apps/
- [ ] Regenerate App Secret for your Instagram app
- [ ] Update `INSTAGRAM_CLIENT_SECRET` in `.env`

### 2. TikTok OAuth Credentials
- [ ] Go to https://developers.tiktok.com/
- [ ] Regenerate Client Secret
- [ ] Update `TIKTOK_CLIENT_SECRET` in `.env`

### 3. YouTube/Google OAuth Credentials
- [ ] Go to https://console.cloud.google.com/apis/credentials
- [ ] Create new OAuth 2.0 Client ID or regenerate secret
- [ ] Update `YOUTUBE_CLIENT_SECRET` in `.env`

### 4. Twitter OAuth Credentials
- [ ] Go to https://developer.twitter.com/en/portal/dashboard
- [ ] Regenerate Client Secret
- [ ] Update `TWITTER_CLIENT_SECRET` in `.env`

### 5. OpenAI API Key (if used)
- [ ] Go to https://platform.openai.com/api-keys
- [ ] Revoke old key
- [ ] Create new key
- [ ] Update `OPENAI_API_KEY` in `.env`

### 6. Runway API Key (if used)
- [ ] Go to your Runway account settings
- [ ] Regenerate API key
- [ ] Update `RUNWAY_API_KEY` in `.env`

### 7. Encryption Key
- [ ] Run: `node scripts/init-encryption.cjs`
- [ ] This will generate a new secure 32-byte encryption key
- [ ] Update `ENCRYPTION_KEY` in `.env`

## 📋 ROTATION CHECKLIST

```bash
# 1. Backup current .env (in case you need to reference old values)
cp .env .env.backup.$(date +%Y%m%d)

# 2. Generate new encryption key
node scripts/init-encryption.cjs

# 3. Update all OAuth secrets from provider dashboards (see above)

# 4. Test each OAuth flow to ensure new credentials work

# 5. Securely delete old encryption key storage
rm -f data/.encryption_key

# 6. Securely delete backup after confirming everything works
# (Wait 24-48 hours, then delete .env.backup.* files)
```

## 🔒 SECURE .env MANAGEMENT GOING FORWARD

### For Development:
1. **Never commit `.env` files** - Already in `.gitignore` ✅
2. **Use `.env.example`** for templates (safe to commit)
3. **Store production secrets** in secure vault (1Password, Azure Key Vault, AWS Secrets Manager)
4. **Use different credentials** for dev/staging/production

### For Production:
1. **Use environment variables** from hosting platform
2. **Use OS credential stores** (Windows Credential Manager, macOS Keychain)
3. **Enable secret rotation** on a schedule (every 90 days)
4. **Monitor for unauthorized access** to OAuth apps

## ✅ VERIFICATION STEPS

After rotation, verify each service:

```bash
# 1. Start the app
npm start

# 2. Test Instagram OAuth
# - Click "Connect Instagram"
# - Verify successful authentication
# - Check that token is saved

# 3. Test TikTok OAuth
# - Click "Connect TikTok"
# - Verify successful authentication

# 4. Test YouTube OAuth
# - Click "Connect YouTube"
# - Verify successful authentication

# 5. Test Twitter OAuth
# - Click "Connect Twitter"
# - Verify successful authentication

# 6. Test AI image generation (if using OpenAI)
# - Generate a test meme
# - Verify image is created

# 7. Check encryption
# - View data/settings.json
# - Verify API keys are encrypted (should see "hex:hex:hex" format)
```

## 🚫 WHAT NOT TO DO

- ❌ Don't email secrets (even encrypted)
- ❌ Don't post secrets in Slack/Teams/chat
- ❌ Don't store secrets in notes apps that sync to cloud
- ❌ Don't commit secrets to git (even private repos)
- ❌ Don't share .env files directly

## ✅ WHAT TO DO

- ✅ Use secure password managers (1Password, Bitwarden, etc.)
- ✅ Use environment variables on servers
- ✅ Use OS credential stores locally
- ✅ Encrypt secrets at rest
- ✅ Rotate secrets regularly
- ✅ Use different secrets per environment

## 📞 QUESTIONS?

If you encounter issues during rotation:
1. Check provider documentation for regeneration steps
2. Ensure redirect URIs match in provider dashboard
3. Verify `.env` file has correct format (no spaces around `=`)
4. Check logs in app for specific error messages

## ⏰ TIMELINE

- **0-2 hours**: Rotate all OAuth secrets
- **2-4 hours**: Test all authentication flows
- **4-6 hours**: Generate and test new encryption key
- **6-8 hours**: Verify all features work with new credentials
- **24 hours**: Delete old backups

**Status**: [ ] Not Started [ ] In Progress [ ] Completed

---

**IMPORTANT**: Mark this task as complete in your team tracking system once all secrets are rotated and verified.
