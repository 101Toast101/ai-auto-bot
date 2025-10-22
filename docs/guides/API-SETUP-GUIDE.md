\# API Setup Guide

Complete guide to getting all API keys and tokens for AI Auto Bot.

\## 🤖 OpenAI API (For AI Image Generation)

\*\*Cost:\*\* Pay-as-you-go (~$0.04-0.08 per image)

\### Setup Steps:

1\. Go to https://platform.openai.com/signup

2\. Create an account or sign in

3\. Add payment method: https://platform.openai.com/account/billing

4\. Go to API keys: https://platform.openai.com/api-keys

5\. Click "Create new secret key"

6\. Copy the key (starts with `sk-...`)

7\. \*\*Paste into AI Auto Bot\*\* → General section → API Key field

\### Test Your Key:

\- Select Content Type: \*\*Meme\*\*

\- Select Meme Mode: \*\*AI Generate\*\*

\- Enter prompt: "a funny cat wearing sunglasses"

\- Click \*\*Generate\*\*

\- If successful, image appears in preview

---

\## 📸 Instagram Graph API

\*\*Requirements:\*\*

\- Facebook Business account

\- Instagram Business/Creator account

\- Facebook Developer account

\### Setup Steps:

\#### 1. Convert Instagram to Business Account:

1\. Open Instagram app

2\. Go to Settings → Account → Switch to Professional Account

3\. Choose "Business" or "Creator"

\#### 2. Create Facebook Page:

1\. Go to https://www.facebook.com/pages/create

2\. Create a page for your business

3\. Link Instagram to this page:

&nbsp; - Page Settings → Instagram → Connect Account

\#### 3. Get Facebook Developer Account:

1\. Go to https://developers.facebook.com

2\. Sign up / Log in

3\. Click "My Apps" → "Create App"

4\. Choose "Business" type

5\. Fill in app details

\#### 4. Get Access Token:

1\. In your app dashboard, go to \*\*Graph API Explorer\*\*

2\. Select your app and page

3\. Add permissions:

&nbsp; - `instagram\_basic`

&nbsp; - `instagram\_content\_publish`

&nbsp; - `pages\_read\_engagement`

4\. Click "Generate Access Token"

5\. Copy the token

6\. \*\*Paste into AI Auto Bot\*\* → Tokens section → Instagram Token

\### Important Notes:

\- Tokens expire every 60 days (use long-lived tokens)

\- Need Facebook Page + Instagram Business account

\- Must be page admin

---

\## 🎵 TikTok API

\*\*Requirements:\*\*

\- TikTok Developer account

\- App approval (takes 1-2 weeks)

\### Setup Steps:

\#### 1. Register as Developer:

1\. Go to https://developers.tiktok.com

2\. Click "Register"

3\. Log in with TikTok account

4\. Complete developer registration

\#### 2. Create App:

1\. Go to "Manage Apps"

2\. Click "Create App"

3\. Fill in details:

&nbsp; - App Name

&nbsp; - Description

&nbsp; - Website URL

4\. Submit for review (takes 1-2 weeks)

\#### 3. Get Access Token:

1\. Once approved, go to app settings

2\. Note your Client Key and Client Secret

3\. Follow OAuth flow:

&nbsp; ```

&nbsp; https://www.tiktok.com/auth/authorize/

&nbsp; ?client_key=YOUR_CLIENT_KEY

&nbsp; \&response_type=code

&nbsp; \&scope=user.info.basic,video.upload

&nbsp; \&redirect_uri=YOUR_REDIRECT_URI

&nbsp; ```

4\. Exchange code for token

5\. \*\*Paste into AI Auto Bot\*\* → Tokens section → TikTok Token

\### Important Notes:

\- Video content works better than images

\- Limited to 50 posts per day

\- Requires app approval

---

\## 📺 YouTube Data API

\*\*Requirements:\*\*

\- Google Cloud account

\- YouTube channel

\### Setup Steps:

\#### 1. Enable YouTube API:

1\. Go to https://console.cloud.google.com

2\. Create new project or select existing

3\. Go to "APIs \& Services" → "Library"

4\. Search "YouTube Data API v3"

5\. Click "Enable"

\#### 2. Create OAuth Credentials:

1\. Go to "APIs \& Services" → "Credentials"

2\. Click "Create Credentials" → "OAuth client ID"

3\. Choose "Desktop app"

4\. Download credentials JSON

\#### 3. Get Access Token:

1\. Use Google OAuth 2.0 Playground: https://developers.google.com/oauthplayground

2\. Select "YouTube Data API v3"

3\. Authorize APIs

4\. Exchange authorization code for tokens

5\. Copy the access token

6\. \*\*Paste into AI Auto Bot\*\* → Tokens section → YouTube Token

\### Important Notes:

\- Tokens expire every hour (refresh required)

\- Free tier: 10,000 units/day

\- Community posts require 1,000+ subscribers

---

\## 🐦 Twitter API v2

\*\*Requirements:\*\*

\- Twitter Developer account

\- App approval

\### Setup Steps:

\#### 1. Apply for Developer Account:

1\. Go to https://developer.twitter.com/en/portal/petition/essential/basic-info

2\. Select "Hobbyist" → "Making a bot"

3\. Fill out application (explain your use case)

4\. Wait for approval (instant to 24 hours)

\#### 2. Create App:

1\. Go to Developer Portal: https://developer.twitter.com/en/portal/dashboard

2\. Create "Project" → Create "App"

3\. Save your API keys:

&nbsp; - API Key

&nbsp; - API Secret Key

&nbsp; - Bearer Token

\#### 3. Enable OAuth 2.0:

1\. In app settings, enable "OAuth 2.0"

2\. Set permissions: "Read and Write"

3\. Add redirect URL (for OAuth flow)

\#### 4. Get Access Token:

1\. Go to app settings → "Keys and tokens"

2\. Generate "Access Token and Secret"

3\. Save both tokens

4\. \*\*Paste Access Token into AI Auto Bot\*\* → Tokens section → Twitter Token

\### Important Notes:

\- Free tier: 1,500 tweets/month

\- Basic tier ($100/mo): 50,000 tweets/month

\- Must explain bot purpose in application

---

\## 🔒 Security Best Practices

\### ✅ DO:

\- Keep tokens encrypted (AI Auto Bot does this automatically)

\- Never share tokens publicly

\- Regenerate tokens if compromised

\- Use environment-specific tokens (dev/prod)

\### ❌ DON'T:

\- Commit `data/\*.json` to Git (already in .gitignore)

\- Screenshot tokens

\- Share config files

\- Use production tokens for testing

---

\## 📊 Cost Summary

| Service | Free Tier | Paid Plans |

|---------|-----------|------------|

| \*\*OpenAI\*\* | $5 credit for new accounts | ~$0.04/image (DALL-E 3) |

| \*\*Instagram\*\* | Free | Free |

| \*\*TikTok\*\* | 50 posts/day | Enterprise plans available |

| \*\*YouTube\*\* | 10,000 units/day | Paid quotas available |

| \*\*Twitter\*\* | 1,500 tweets/month | Basic: $100/mo (50K tweets) |

---

\## 🧪 Testing Your Setup

\### Quick Test Checklist:

1\. \*\*OpenAI API\*\*

&nbsp; - \[ ] Generate AI image successfully

&nbsp; - \[ ] Image appears in preview

&nbsp; - \[ ] No API errors

2\. \*\*Instagram\*\*

&nbsp; - \[ ] Post a test meme

&nbsp; - \[ ] Check Instagram feed

&nbsp; - \[ ] Verify post caption/hashtags

3\. \*\*TikTok\*\*

&nbsp; - \[ ] Upload test content

&nbsp; - \[ ] Check TikTok profile

&nbsp; - \[ ] Verify video is live

4\. \*\*YouTube\*\*

&nbsp; - \[ ] Post community update

&nbsp; - \[ ] Check YouTube community tab

&nbsp; - \[ ] Verify post visibility

5\. \*\*Twitter\*\*

&nbsp; - \[ ] Tweet test meme

&nbsp; - \[ ] Check Twitter profile

&nbsp; - \[ ] Verify media uploaded

---

\## ❓ Troubleshooting

\### "Invalid API Key"

\- Check key is copied completely (no spaces)

\- Verify key hasn't expired

\- Ensure billing is set up (OpenAI)

\### "Insufficient Permissions"

\- Review required scopes for each platform

\- Re-authorize with correct permissions

\- Check account type (Business vs Personal)

\### "Rate Limit Exceeded"

\- Wait for rate limit to reset

\- Upgrade to paid tier

\- Reduce posting frequency

\### "Token Expired"

\- Some platforms require token refresh

\- Generate new token

\- Implement refresh token logic

---

\## 📞 Support Resources

\- \*\*OpenAI\*\*: https://help.openai.com

\- \*\*Instagram\*\*: https://developers.facebook.com/support

\- \*\*TikTok\*\*: https://developers.tiktok.com/support

\- \*\*YouTube\*\*: https://support.google.com/youtube/topic/9257888

\- \*\*Twitter\*\*: https://developer.twitter.com/en/support

---

\## 🎉 You're All Set!

Once all APIs are configured, you can:

\- ✅ Generate AI images

\- ✅ Post to multiple platforms instantly

\- ✅ Schedule posts for auto-publishing

\- ✅ Bulk generate and export content

\- ✅ Track everything in your content library

Happy automating! 🚀
