# AI Provider Authentication System Implementation

## Overview

Replaced the plain-text API key input field with a secure, login-style authentication system similar to the social media OAuth flow.

## Changes Made

### 1. UI Updates (`index.html`)

#### Removed:

- Plain text "General" fieldset with:
  - AI Provider dropdown (visible)
  - API Key input field (plain text)

#### Added:

- **New "Connect AI Providers" fieldset** with:
  - Feature highlight explaining encryption
  - Connection buttons for each provider (OpenAI, Runway ML)
  - Visual status indicators (🔗 Connect / ✓ Connected)
  - Hidden fields to store encrypted keys and active provider

- **AI Key Modal Dialog** with:
  - Secure password input field
  - Toggle visibility button
  - Provider-specific help text with links to get API keys
  - "Test Connection" button (validates API key before saving)
  - "Save & Connect" button
  - Status indicator for feedback

### 2. Styling (`styles.css`)

Added styles for:

- `.ai-connect-btn` - Connection button styling
- `.connected` state - Visual feedback when connected
- `#aiKeyModal` - Modal dialog styling
- `#aiKeyStatus` - Success/error status messages
- Dark mode support for all new elements

### 3. JavaScript Logic (`renderer.js`)

#### New Functions:

**AI Provider Management:**

- `openAiKeyModal(provider)` - Opens modal for specific provider
- `closeAiKeyModal()` - Closes the modal
- `showAiKeyStatus(message, type)` - Shows status messages

**API Key Validation:**

- `testAiConnection()` - Tests API key before saving
  - For OpenAI: Validates format (sk-\*) and makes test API call
  - For Runway: Validates format only (no public test endpoint)

**Storage & Security:**

- `saveAiKey()` - Encrypts and saves API key
  - Uses `window.api.encrypt()` for encryption
  - Stores in hidden input fields
  - Persists to `data/settings.json`
  - Updates button visual state

**UI Helpers:**

- `toggleAiKeyVisibility()` - Show/hide API key in input
- `checkAiProviderConnections()` - Checks which providers are connected on app load

#### Updated Functions:

**`handleMemeActionClick()`:**

- Now retrieves API key from encrypted storage
- Decrypts key before use
- Shows helpful error if provider not connected

**`generateAIImage(apiKey, provider)`:**

- Added `provider` parameter
- Updated function signature

**`editAIImage(apiKey, provider)`:**

- Added `provider` parameter
- Updated function signature

**`init()`:**

- Calls `checkAiProviderConnections()` on startup
- Restores connection status from saved settings

#### Provider Information:

```javascript
const aiProviderInfo = {
  openai: {
    name: "OpenAI",
    helpText: "Instructions for getting OpenAI API key",
    testEndpoint: "https://api.openai.com/v1/models",
    keyPattern: /^sk-/,
  },
  runway: {
    name: "Runway ML",
    helpText: "Instructions for getting Runway API key",
  },
};
```

#### Sensitive Fields:

Updated `SENSITIVE_FIELDS` array to include:

- `openaiApiKey`
- `runwayApiKey`
- Legacy `apiKey` (for backwards compatibility)

## User Experience

### Before:

1. User enters API key in plain text field
2. Key visible to anyone looking at screen
3. No validation before save
4. No visual feedback about connection status

### After:

1. User clicks "Connect OpenAI" button
2. Modal opens with secure password field
3. Provider-specific help text with links to get API keys
4. User can test connection before saving
5. API key encrypted before storage
6. Visual feedback: button changes to "✓ Connected"
7. API key hidden from view but accessible when needed

## Security Improvements

✅ **No plain text storage** - API keys encrypted at rest
✅ **Password field** - Keys hidden during entry
✅ **Validation** - Keys tested before saving
✅ **Visual indicators** - Clear connection status
✅ **Help text** - Users know where to get keys
✅ **Backwards compatible** - Old `apiKey` field still decrypted if present

## Testing Checklist

- [ ] Click "Connect OpenAI" - modal opens
- [ ] Enter invalid key format - shows error
- [ ] Enter valid key - test connection works
- [ ] Save key - encrypts and stores correctly
- [ ] Button shows "✓ Connected" state
- [ ] Restart app - connection status persists
- [ ] Generate meme with AI - uses decrypted key
- [ ] Dark mode - modal styled correctly
- [ ] Click "Connect Runway ML" - shows Runway-specific help

## Files Modified

1. `index.html` - New UI structure
2. `styles.css` - New styling
3. `renderer.js` - Authentication logic

## Migration Path

Existing users with `apiKey` in settings:

- Old key will still be decrypted and usable
- System will prompt to re-enter via new modal
- Once re-entered, stored as `openaiApiKey` with better encryption

## Future Enhancements

Potential improvements:

- [ ] Add more AI providers (Claude, Stable Diffusion, etc.)
- [ ] API usage tracking
- [ ] Rate limit warnings
- [ ] Key rotation reminders
- [ ] Multi-key support (multiple OpenAI keys for rate limiting)
- [ ] Key validation on app startup
- [ ] "Disconnect" button to remove stored keys
- [ ] Import/export encrypted keys

## Provider-Specific Notes

### OpenAI

- API keys start with `sk-`
- Test endpoint: `GET https://api.openai.com/v1/models`
- Requires billing enabled
- Get keys at: https://platform.openai.com/api-keys

### Runway ML

- No standard key format
- No public test endpoint (validation on first use)
- Requires paid subscription
- Get keys at: https://app.runwayml.com/account

## Troubleshooting

**Modal doesn't open:**

- Check console for errors
- Verify `bindUi()` is called in init
- Check if button click handler is attached

**Test connection fails:**

- Verify API key format (OpenAI must start with `sk-`)
- Check internet connection
- Verify API key is valid on provider's website
- Check browser console for CORS errors

**Key not persisting:**

- Check `data/settings.json` file permissions
- Verify encryption is working (`window.api.encrypt`)
- Check for validation errors in console

**Connected state not showing after restart:**

- Check `checkAiProviderConnections()` is called in `init()`
- Verify settings file contains encrypted keys
- Check if decryption is successful
