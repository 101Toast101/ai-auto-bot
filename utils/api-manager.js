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
  console.warn("📷 Instagram - Request parameters:", {
    imageUrl,
    caption,
  });
  console.warn("📷 Instagram - Token present:", !!token);

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

  console.warn("📷 Instagram - API response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
  console.warn("📷 Instagram - Full response body:", errorData);
      return {
        success: false,
        error: `Instagram post failed: ${response.status}`,
      };
    }

    const data = await response.json();
  console.warn("📷 Instagram - Full response body:", data);
    return {
      success: true,
      postId: data.id,
    };
  } catch (error) {
  console.warn("📷 Instagram - Error:", error.message);
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
  console.warn("🎵 TikTok - Request parameters:", {
    videoUrl,
    description,
  });
  console.warn("🎵 TikTok - Token present:", !!token);

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

  console.warn("🎵 TikTok - API response status:", response.status);

    if (!response.ok) {
      // Prefer status-based handling first to avoid issues where response.json
      // isn't a function on mocked responses (tests) or non-standard bodies.
      if (response.status === 429) {
        return { success: false, error: "TikTok rate limit exceeded" };
      }

      // Attempt to read body only if response.json is callable
      let errorData = {};
      if (response && typeof response.json === "function") {
        errorData = await response.json().catch(() => ({}));
      }
  console.warn("🎵 TikTok - Full response body:", errorData);
      return {
        success: false,
        error: `TikTok post failed: ${response.status}`,
      };
    }

    const data = await response.json();
  console.warn("🎵 TikTok - Full response body:", data);
    return {
      success: true,
      videoId: data.video_id,
    };
  } catch (error) {
  console.warn("🎵 TikTok - Error:", error.message);
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
  console.warn("📺 YouTube - Request parameters:", {
    contentUrl,
    title,
    description,
  });
  console.warn("📺 YouTube - Token present:", !!token);

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

  console.warn("📺 YouTube - API response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
  console.warn("📺 YouTube - Full response body:", errorData);
      return {
        success: false,
        error: `YouTube post failed: ${response.status}`,
      };
    }

    const data = await response.json();
  console.warn("📺 YouTube - Full response body:", data);
    return {
      success: true,
      videoId: data.id,
    };
  } catch (error) {
  console.warn("📺 YouTube - Error:", error.message);
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
  console.warn("🐦 Twitter - Request parameters:", {
    text,
    textLength: text.length,
  });
  console.warn("🐦 Twitter - Token present:", !!token);

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

  console.warn("🐦 Twitter - API response status:", response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
  console.warn("🐦 Twitter - Full response body:", errorData);
      return {
        success: false,
        error: `Twitter post failed: ${response.status}`,
      };
    }

    const data = await response.json();
  console.warn("🐦 Twitter - Full response body:", data);
    return {
      success: true,
      tweetId: data.data.id,
    };
  } catch (error) {
  console.warn("🐦 Twitter - Error:", error.message);
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
