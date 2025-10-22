# 🚀 AI Auto Bot - Full Production Deployment Checklist

## Overview

This checklist ensures your app is 100% production-ready with full social media OAuth integration.

**Estimated Total Time**: 3.5 - 4.5 hours

---

## ✅ PHASE 1: OAuth App Registration (1-2 hours)

### Instagram (via Facebook/Meta)

- [ ] Go to https://developers.facebook.com/
- [ ] Create new app (Business type)
- [ ] Add "Instagram Basic Display" product
- [ ] Configure OAuth redirect: `http://localhost:3000/oauth/callback`
- [ ] Add test users (your Instagram account)
- [ ] Copy **App ID** → Save for `.env`
- [ ] Copy **App Secret** → Save for `.env`
- [ ] Note: Submit for review later for production users

**Credentials Needed**:

```
INSTAGRAM_CLIENT_ID=<App ID>
INSTAGRAM_CLIENT_SECRET=<App Secret>
```

---

### TikTok

- [ ] Go to https://developers.tiktok.com/
- [ ] Create new app
- [ ] Add "Login Kit" and "Content Posting API" products
- [ ] Configure redirect URI: `http://localhost:3000/oauth/callback`
- [ ] Request scopes: `user.info.basic`, `video.upload`
- [ ] Copy **Client Key** → Save for `.env`
- [ ] Copy **Client Secret** → Save for `.env`

**Credentials Needed**:

```
TIKTOK_CLIENT_KEY=<Client Key>
TIKTOK_CLIENT_SECRET=<Client Secret>
```

---

### YouTube (via Google Cloud)

- [ ] Go to https://console.cloud.google.com/
- [ ] Create new project: "AI Auto Bot"
- [ ] Enable "YouTube Data API v3"
- [ ] Create OAuth 2.0 Client ID (Desktop app type)
- [ ] Configure OAuth consent screen
- [ ] Add scopes: `https://www.googleapis.com/auth/youtube.upload`
- [ ] Add redirect URI: `http://localhost:3000/oauth/callback`
- [ ] Copy **Client ID** (ends in .apps.googleusercontent.com) → Save for `.env`
- [ ] Copy **Client Secret** → Save for `.env`

**Credentials Needed**:

```
YOUTUBE_CLIENT_ID=<Client ID>.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=<Client Secret>
```

---

### Twitter

- [ ] Go to https://developer.twitter.com/
- [ ] Apply for developer account (if needed)
- [ ] Create new project: "AI Auto Bot"
- [ ] Create app under project
- [ ] Configure OAuth 2.0 (Web App type)
- [ ] Add callback URL: `http://localhost:3000/oauth/callback`
- [ ] Set permissions: Read and Write
- [ ] Copy **Client ID** → Save for `.env`
- [ ] Copy **Client Secret** → Save for `.env`

**Credentials Needed**:

```
TWITTER_CLIENT_ID=<Client ID>
TWITTER_CLIENT_SECRET=<Client Secret>
```

---

## ✅ PHASE 2: Update Configuration (30 minutes)

### Step 2.1: Update `.env` File

- [x] `.env` file cleaned up (already done)
- [ ] Replace `YOUR_INSTAGRAM_APP_ID` with real Instagram App ID
- [ ] Replace `YOUR_INSTAGRAM_APP_SECRET` with real Instagram App Secret
- [ ] Replace `YOUR_TIKTOK_CLIENT_KEY` with real TikTok Client Key
- [ ] Replace `YOUR_TIKTOK_CLIENT_SECRET` with real TikTok Client Secret
- [ ] Replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with real YouTube Client ID
- [ ] Replace `YOUR_YOUTUBE_CLIENT_SECRET` with real YouTube Client Secret
- [ ] Replace `YOUR_TWITTER_CLIENT_ID` with real Twitter Client ID
- [ ] Replace `YOUR_TWITTER_CLIENT_SECRET` with real Twitter Client Secret
- [ ] (Optional) Replace `YOUR_REAL_OPENAI_KEY_HERE` with real OpenAI API key
- [ ] (Optional) Replace `YOUR_REAL_RUNWAY_KEY_HERE` with real Runway ML API key
- [ ] Verify `NODE_ENV=production`
- [ ] Verify `ENCRYPTION_KEY` is set (64-character hex string)

### Step 2.2: Update `package.json`

- [ ] Edit line 27: Change `"author": "Your Name <you@example.com>"` to your real name and email

---

## ✅ PHASE 3: Code Fixes (COMPLETED ✅)

### Step 3.1: Fix OAuth Implementation

- [x] Added `require('dotenv').config()` to `main.js`
- [x] Updated OAuth handler to use `process.env` variables
- [x] Fixed token exchange with real client credentials
- [x] Added credential validation check
- [x] Fixed `resolved` variable issue

### Step 3.2: (Optional) Clean Up Console Logs

- [ ] Review `renderer.js` console.log statements
- [ ] Replace with `addLogEntry()` calls for production logging
- [ ] Remove debug console.logs (search for `console.log`)

**Note**: This is optional but recommended for cleaner production code.

---

## ✅ PHASE 4: Testing (1 hour)

### Test OAuth Flows

- [ ] Start app: `npm start`
- [ ] Test Instagram connection:
  - [ ] Click "Connect Instagram"
  - [ ] Login flow completes successfully
  - [ ] Token received and stored
  - [ ] Button shows "✓ Connected"
- [ ] Test TikTok connection:
  - [ ] Click "Connect TikTok"
  - [ ] Login flow completes successfully
  - [ ] Token received and stored
  - [ ] Button shows "✓ Connected"
- [ ] Test YouTube connection:
  - [ ] Click "Connect YouTube"
  - [ ] Login flow completes successfully
  - [ ] Token received and stored
  - [ ] Button shows "✓ Connected"
- [ ] Test Twitter connection:
  - [ ] Click "Connect Twitter"
  - [ ] Login flow completes successfully
  - [ ] Token received and stored
  - [ ] Button shows "✓ Connected"

### Test Content Generation

- [ ] Generate a meme
- [ ] Save meme to library
- [ ] Generate a video (if OpenAI/Runway configured)
- [ ] Save video to library

### Test Posting

- [ ] Create test post with meme
- [ ] Select platforms (all 4)
- [ ] Click "Post Now"
- [ ] Verify posts appear on all platforms
- [ ] Check Activity Log for success messages

### Test Scheduling

- [ ] Create scheduled post (5 minutes in future)
- [ ] Select platforms
- [ ] Click "Schedule Post"
- [ ] Wait for scheduled time
- [ ] Verify post executes automatically
- [ ] Check Activity Log

### Test Data Persistence

- [ ] Restart app
- [ ] Verify layout saved correctly
- [ ] Verify OAuth connections still show "✓ Connected"
- [ ] Verify library items still present
- [ ] Verify Activity Log history persists

---

## ✅ PHASE 5: Build & Deploy (30 minutes)

### Production Build

- [ ] Stop development app if running
- [ ] Run: `npm run dist`
- [ ] Wait for build to complete (may take 5-10 minutes)
- [ ] Check `dist/` folder for output files

### Test Final Build

- [ ] Run built executable from `dist/`
- [ ] Test OAuth connections
- [ ] Test content generation
- [ ] Test posting to platforms
- [ ] Verify all features work in built version

### Create Release Documentation

- [ ] Update `change-log.md` with v1.0 features
- [ ] Document known limitations (if any)
- [ ] Create user guide for OAuth setup
- [ ] Prepare release notes

---

## 🎯 FINAL VERIFICATION

Before declaring production-ready, verify:

- [ ] **All OAuth flows work** (4/4 platforms)
- [ ] **Posting works** to all platforms
- [ ] **No console errors** in Activity Log
- [ ] **Data persists** after app restart
- [ ] **Scheduling works** automatically
- [ ] **Build completes** without errors
- [ ] **Final executable runs** without issues

---

## ✅ DEPLOYMENT STATUS

Once all checkboxes are complete:

**Status**: ✅ **READY FOR PRODUCTION DEPLOYMENT**

All critical and medium issues resolved:

- ✅ OAuth credentials configured
- ✅ Token exchange working
- ✅ Environment variables in use
- ✅ Code properly structured
- ✅ No test credentials
- ✅ Author information updated

---

## 📝 NOTES

**Time Spent**:

- Phase 1: **\_** hours
- Phase 2: **\_** minutes
- Phase 3: **\_** minutes (mostly automated)
- Phase 4: **\_** hour
- Phase 5: **\_** minutes

**Total**: **\_** hours

## **Issues Encountered**:

-
- **Resolved By**:

-
-
- ***

## 🚀 NEXT STEPS AFTER DEPLOYMENT

1. Monitor Activity Log for errors
2. Collect user feedback
3. Submit OAuth apps for production review:
   - Instagram: Facebook App Review
   - TikTok: Developer verification
   - YouTube: OAuth consent screen verification
   - Twitter: Elevated access application
4. Plan v1.1 features based on feedback

---

**Last Updated**: October 20, 2025
**Version**: 1.0.0
**Status**: Ready for Configuration
