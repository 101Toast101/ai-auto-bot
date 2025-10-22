// utils/api-manager.js
// API Management utilities for social media platforms

/**
 * Generate AI image using OpenAI DALL-E API
 */
async function generateAIImage(prompt, apiKey) {
  if (!apiKey) {
    return { success: false, error: "API key not provided" };
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to generate image: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      imageUrl: data.data[0].url,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post content to Instagram
 */
async function postToInstagram(imageUrl, caption, token) {
  if (!token) {
    return { success: false, error: "Instagram token not provided" };
  }

  try {
    const response = await fetch("https://graph.facebook.com/v12.0/me/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: token,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Instagram post failed: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      postId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post video to TikTok
 */
async function postToTikTok(videoUrl, description, token) {
  if (!token) {
    return { success: false, error: "TikTok token not provided" };
  }

  try {
    const response = await fetch(
      "https://open-api.tiktok.com/share/video/upload",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          video_url: videoUrl,
          description: description,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return { success: false, error: "TikTok rate limit exceeded" };
      }
      return {
        success: false,
        error: `TikTok post failed: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      videoId: data.video_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post to YouTube
 */
async function postToYouTube(contentUrl, title, description, token) {
  if (!token) {
    return { success: false, error: "YouTube token not provided" };
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          snippet: {
            title: title,
            description: description,
          },
          status: {
            privacyStatus: "public",
          },
        }),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        error: `YouTube post failed: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      videoId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Post to Twitter
 */
async function postToTwitter(text, token) {
  if (!token) {
    return { success: false, error: "Twitter token not provided" };
  }

  // Check character limit
  if (text.length > 280) {
    return { success: false, error: "Tweet exceeds character limit (280)" };
  }

  try {
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: text,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Twitter post failed: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      tweetId: data.data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  generateAIImage,
  postToInstagram,
  postToTikTok,
  postToYouTube,
  postToTwitter,
};
