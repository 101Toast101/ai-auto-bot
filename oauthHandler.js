// oauthHandler.js
const { saveToken } = require("./tokenStore");
const express = require("express");
const axios = require("axios");
const router = express.Router();
require("dotenv").config();

// ✅ Instagram OAuth
router.get("/auth/instagram", (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/auth/instagram/callback`;
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.INSTAGRAM_APP_ID}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code`;
  res.redirect(authUrl);
});

router.get("/auth/instagram/callback", async (req, res) => {
  const { code } = req.query;
  const tokenRes = await axios.post(
    `https://graph.facebook.com/v18.0/oauth/access_token`,
    null,
    {
      params: {
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        redirect_uri: `${process.env.BASE_URL}/auth/instagram/callback`,
        code,
      },
    },
  );
  const accessToken = tokenRes.data.access_token;
  saveToken("instagram", accessToken);
  res.redirect("/dashboard?connected=instagram");
});

// ✅ TikTok OAuth
router.get("/auth/tiktok", (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/auth/tiktok/callback`;
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&redirect_uri=${redirectUri}&scope=user.info.basic,video.list&response_type=code`;
  res.redirect(authUrl);
});

router.get("/auth/tiktok/callback", async (req, res) => {
  const { code } = req.query;
  const tokenRes = await axios.post(
    `https://open-api.tiktok.com/oauth/access_token`,
    {
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    },
  );
  const accessToken = tokenRes.data.data.access_token;
  saveToken("ticktok", accessToken);
  res.redirect("/dashboard?connected=tiktok");
});

// ✅ YouTube OAuth
router.get("/auth/youtube", (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/auth/youtube/callback`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YOUTUBE_CLIENT_ID}&redirect_uri=${redirectUri}&scope=https://www.googleapis.com/auth/youtube.upload&response_type=code&access_type=offline`;
  res.redirect(authUrl);
});

router.get("/auth/youtube/callback", async (req, res) => {
  const { code } = req.query;
  const tokenRes = await axios.post(`https://oauth2.googleapis.com/token`, {
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    code,
    redirect_uri: `${process.env.BASE_URL}/auth/youtube/callback`,
    grant_type: "authorization_code",
  });
  const accessToken = tokenRes.data.access_token;
  saveToken("youtube", accessToken);
  res.redirect("/dashboard?connected=youtube");
});

// ✅ Twitter OAuth 2.0
router.get("/auth/twitter", (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/auth/twitter/callback`;
  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${redirectUri}&scope=tweet.read,tweet.write,users.read&state=random123&code_challenge=challenge&code_challenge_method=plain`;
  res.redirect(authUrl);
});

router.get("/auth/twitter/callback", async (req, res) => {
  const { code } = req.query;
  const tokenRes = await axios.post(`https://api.twitter.com/2/oauth2/token`, {
    client_id: process.env.TWITTER_CLIENT_ID,
    client_secret: process.env.TWITTER_CLIENT_SECRET,
    code,
    redirect_uri: `${process.env.BASE_URL}/auth/twitter/callback`,
    grant_type: "authorization_code",
    code_verifier: "challenge",
  });
  const accessToken = tokenRes.data.access_token;
  saveToken("twitter", accessToken);
  res.redirect("/dashboard?connected=twitter");
});

module.exports = router;
