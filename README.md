# AI Auto Bot

AI-powered social media automation tool for creating and scheduling memes and video content across multiple platforms.

## Features

- 🎨 **Bulk Meme Generation** - Generate 10-100 memes at once with platform-specific sizing
- 🤖 **AI Image Generation** - Create custom memes with OpenAI DALL-E 3
- ✏️ **AI Image Editing** - Edit existing images with AI prompts
- 🔄 **AI Variations** - Create 4 variations of any image instantly
- 📤 **Multi-Platform Posting** - Post to Instagram, TikTok, YouTube, Twitter simultaneously
- 📅 **Auto-Scheduling** - Schedule posts with automatic execution
- 🔐 **Secure Encryption** - API keys encrypted with machine-specific keys
- 💾 **Config Management** - Save and load multiple configuration presets
- 📚 **Content Library** - Organize and reuse generated content
- 🌙 **Dark Mode** - Eye-friendly dark theme
- 🎯 **Smart Features** - Trending topics, seasonal content, audience optimization
- 📊 **Activity Logging** - Track all actions and API calls

## What's New - Fully Functional! 🎉

### ✅ Now Working:

- **AI Image Generation** - Generate custom images from text prompts
- **AI Image Editing** - Edit images with AI-powered modifications
- **AI Variations** - Create multiple variations of any image
- **Social Media Posting** - Actually publishes to Instagram, TikTok, YouTube, Twitter
- **Auto-Scheduler** - Executes scheduled posts automatically every minute
- **Loading Spinners** - Visual feedback during long operations
- **Error Handling** - Detailed error messages for troubleshooting

### 🔧 Setup Required:

See **[API-SETUP-GUIDE.md](API-SETUP-GUIDE.md)** for complete instructions on:

- Getting OpenAI API key
- Setting up Instagram Graph API
- Configuring TikTok Developer account
- Enabling YouTube Data API
- Applying for Twitter API access

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm start
```

### Build for Production

```bash
npm run dist
```

This creates installers in the `/dist` folder:

- **macOS**: `.dmg` file
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` file

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root (use `.env.example` as template):

```bash
# Required - Encryption key (64 hex characters, 32 bytes)
ENCRYPTION_KEY=your_64_character_hex_key_here

# Optional - OAuth Client Credentials (can also configure in-app)
INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret

TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret

TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret

# OAuth redirect URI (default: http://localhost:3000/oauth/callback)
REDIRECT_URI=http://localhost:3000/oauth/callback
```

**Generate encryption key:**
```bash
npm run init:key
```

### 3. OAuth Setup (Choose One Method)

#### Method A: In-App Configuration (Recommended)
1. Launch the app
2. Click any platform's **Connect** button
3. If no credentials found, you'll be prompted to enter:
   - Client ID
   - Client Secret
   - Redirect URI
4. Save settings - they're encrypted and stored securely

#### Method B: Environment Variables
1. Copy `.env.example` to `.env`
2. Fill in OAuth credentials from each platform
3. App will read from environment on startup

### 4. Get Platform API Credentials

**Instagram (Meta/Facebook):**
- Create app at [developers.facebook.com](https://developers.facebook.com)
- Products → Add "Instagram Basic Display" or "Instagram Graph API"
- Get Client ID and Client Secret from Settings → Basic
- Add redirect URI: `http://localhost:3000/oauth/callback`

**TikTok:**
- Apply at [developers.tiktok.com](https://developers.tiktok.com)
- Create app and get Client Key and Client Secret
- Add redirect URI in app settings
- Note: Requires developer approval (1-7 days)

**YouTube (Google):**
- Create project at [console.cloud.google.com](https://console.cloud.google.com)
- Enable "YouTube Data API v3"
- Create OAuth 2.0 credentials (Web application)
- Add redirect URI: `http://localhost:3000/oauth/callback`

**Twitter (X):**
- Apply for access at [developer.twitter.com](https://developer.twitter.com)
- Create app and get API keys
- Enable OAuth 2.0
- Add callback URL in app settings

### 5. Configure OpenAI API

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Launch app and go to **General** section
3. Enter API key (automatically encrypted on save)

## Usage

### Development

```bash
npm start
```

### Build for Production

```bash
npm run dist
```

This creates installers in the `/dist` folder:

- **macOS**: `.dmg` file
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` file

## Project Structure

```
ai-auto-bot/
├── main.cjs             # Electron main process (CommonJS)
├── preload.js           # IPC bridge
├── renderer.js          # Frontend logic
├── index.html           # UI
├── styles.css           # Styling
├── package.json         # Dependencies
├── .env                 # Environment variables (DO NOT COMMIT)
├── .env.example         # Environment template
├── data/                # JSON data files (auto-created, encrypted)
│   ├── settings.json
│   ├── savedConfigs.json
│   ├── scheduledPosts.json
│   ├── activity_log.json
│   ├── library.json
│   └── .encryption_key  # Auto-generated if ENCRYPTION_KEY not in .env
├── logs/                # Application logs (production mode)
│   ├── app.log
│   └── error.log
├── utils/               # Utilities
│   ├── config.js
│   ├── encrypt.cjs      # Encryption
│   ├── logger.cjs       # File-based logging
│   ├── validators.cjs   # JSON schema validation
│   ├── sanitize.js      # XSS/injection prevention
│   └── rate-limiter.js  # DoS protection
├── handlers/            # IPC request handlers
│   └── video-handlers.cjs
└── tests/               # Jest test suites
```

## Security

- **Encryption**: API keys and tokens automatically encrypted using AES-256-GCM
- **Machine-Specific**: Encryption key derived from machine identifiers (or provided in `.env`)
- **Input Validation**: All user input sanitized to prevent XSS/injection attacks
- **Rate Limiting**: IPC channels protected against DoS attacks (100 req/min per channel)
- **Audit Logging**: All security events logged to `logs/error.log` in production
- **Environment Isolation**: Never commit `.env`, `data/`, or `logs/` directories

**Security Checklist:**
- ✅ Generate strong encryption key (`npm run init:key`)
- ✅ Add `.env` to `.gitignore` (already included)
- ✅ Rotate OAuth secrets regularly
- ✅ Review `logs/error.log` for security alerts
- ✅ Keep dependencies updated (`npm audit`)

## Tech Stack

- **Electron** - Desktop framework
- **Node.js** - Backend
- **Vanilla JavaScript** - Frontend
- **Memegen API** - Meme templates
- **JSZip** - Bulk export

## Current Limitations

- Video generation UI exists but requires Runway API integration
- Some platform-specific features may require additional permissions
- Rate limits apply based on each platform's API restrictions
- Scheduled posts require app to be running for auto-execution

## API Costs (Pay-as-you-go)

- **OpenAI DALL-E 3**: ~$0.04 per image generation
- **Instagram**: Free (requires Facebook Business account)
- **TikTok**: Free (requires developer approval, 50 posts/day limit)
- **YouTube**: Free tier 10,000 units/day
- **Twitter**: Free tier 1,500 tweets/month, Basic $100/mo for 50K tweets

## Contributing

This is a personal project. Feel free to fork and customize for your needs.

## License

MIT
