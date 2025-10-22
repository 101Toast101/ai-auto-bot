const express = require('express');
const router = express.Router();
const { saveToken } = require('../tokenStore');
const axios = require('axios');

// Unified OAuth callback handler
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code } = req.query;

  try {
    let token;
    switch (provider) {
      case 'instagram':
        token = await handleInstagramAuth(code);
        break;
      // Add other providers here
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    await saveToken(provider, token);
    // Security: Don't expose token in postMessage - it's already saved securely
    // Only notify the opener that authentication is complete
    const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost';
    res.send(`<script>window.opener.postMessage({ type: 'oauth-success', provider: '${provider}' }, '${allowedOrigin}'); window.close();</script>`);
  } catch (error) {
    console.error(`Auth error for ${provider}:`, error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

async function handleInstagramAuth(code) {
  const tokenRes = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', null, {
    params: {
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      redirect_uri: `${process.env.BASE_URL}/auth/instagram/callback`,
      code,
    },
  });
  return tokenRes.data.access_token;
}

module.exports = router;