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

1. Launch the app
2. Go to **General** section and enter your API key (OpenAI or Runway)
3. Go to **Tokens** section and add social media platform tokens
4. Click **Save Config** to save your settings (encrypted automatically)

## Project Structure

```
ai-auto-bot/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── renderer.js          # Frontend logic
├── index.html           # UI
├── styles.css           # Styling
├── package.json         # Dependencies
├── data/                # JSON data files (auto-created)
│   ├── settings.json
│   ├── savedConfigs.json
│   ├── scheduledPosts.json
│   ├── activity_log.json
│   └── library.json
└── utils/               # Utilities
    ├── config.js
    ├── encrypt.js       # Encryption
    ├── error.js
    └── ipc.js

```

## Security

- API keys and tokens are **automatically encrypted** using AES-256-GCM
- Encryption key is derived from machine-specific identifiers
- Encrypted data can only be decrypted on the same machine
- Never commit `data/*.json` files (already in .gitignore)

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