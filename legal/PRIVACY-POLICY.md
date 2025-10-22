# Privacy Policy for AI Auto Bot

**Last Updated**: October 20, 2025

## Introduction

AI Auto Bot ("we", "our", or "the app") is a desktop application that helps users create and manage social media content. This Privacy Policy explains how we handle your information.

## Data Collection and Storage

### What We Collect

- **OAuth Tokens**: When you connect social media accounts (Instagram, TikTok, YouTube, Twitter), we receive access tokens to post on your behalf
- **API Keys**: Your OpenAI and Runway ML API keys (if you choose to use AI features)
- **Content Data**: Memes, videos, captions, and hashtags you create within the app
- **Scheduling Data**: Posts you schedule for future publishing
- **Activity Logs**: Records of actions performed within the app

### How We Store It

- **ALL data is stored locally** on your computer in the `data/` folder
- **Encryption**: All sensitive data (API keys, OAuth tokens) is encrypted using AES-256-GCM encryption
- **No Cloud Storage**: We do NOT upload, sync, or store any of your data on external servers
- **No Analytics**: We do NOT collect usage statistics, crash reports, or telemetry

## Data Usage

We use your data solely for the following purposes:

- **OAuth Tokens**: To post content to your connected social media accounts when you explicitly request it
- **API Keys**: To generate AI content (memes, videos) using OpenAI or Runway ML services
- **Content Data**: To display your library and execute scheduled posts
- **Activity Logs**: To show you a history of actions performed by the app

## Data Sharing

We do NOT:

- Share your data with third parties
- Sell your data
- Use your data for advertising
- Access your data remotely

The only external communication occurs when:

- You explicitly post content to social media platforms (Instagram, TikTok, YouTube, Twitter)
- You use AI generation features (sends prompts to OpenAI/Runway ML with your API key)

## Third-Party Services

The app integrates with the following third-party services (only when you choose to use them):

### Social Media Platforms

- **Instagram/Facebook**: For posting images and videos
- **TikTok**: For posting videos
- **YouTube**: For uploading videos
- **Twitter**: For posting tweets with media

Each platform has its own privacy policy:

- Instagram/Facebook: https://www.facebook.com/privacy/policy/
- TikTok: https://www.tiktok.com/legal/privacy-policy
- YouTube: https://policies.google.com/privacy
- Twitter: https://twitter.com/privacy

### AI Services

- **OpenAI**: For AI image generation (DALL-E)
- **Runway ML**: For AI video generation

Privacy policies:

- OpenAI: https://openai.com/policies/privacy-policy
- Runway ML: https://runwayml.com/privacy/

## Data Security

- All sensitive data (API keys, OAuth tokens) is encrypted using AES-256-GCM
- Encryption keys are machine-specific (derived from your computer's hostname and platform)
- OAuth tokens are stored encrypted and only decrypted when needed to make API calls
- The app uses Electron's security best practices (context isolation, no nodeIntegration)

## Data Retention

- Your data remains on your computer until you manually delete it
- Deleting the app's `data/` folder removes all stored information
- Uninstalling the app does NOT automatically delete your data

## Your Rights

You have complete control over your data:

- **Access**: All data is stored in plain JSON files in the `data/` folder
- **Deletion**: You can delete any content from the library or clear all data
- **Export**: You can manually copy the `data/` folder to backup your information
- **Disconnect**: You can disconnect OAuth accounts at any time

## Children's Privacy

AI Auto Bot is not intended for users under the age of 13. We do not knowingly collect information from children under 13.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Changes will be reflected in the app's documentation and the "Last Updated" date above.

## Contact

If you have questions about this Privacy Policy, please contact:

- **Email**: Crottyjonathan@yahoo.com
- **Developer**: CROTTY
- **GitHub**: https://github.com/101Toast101/ai-auto-bot

## Open Source

AI Auto Bot is open-source software. You can review the code to verify our privacy practices at:
https://github.com/[yourusername]/ai-auto-bot

---

**Summary**: Your data never leaves your computer except when you explicitly post to social media or use AI generation features. We don't collect, store, or share your data with anyone.
