// utils/scheduledposts.js
const { readJson, writeJson } = require("./database");
const { validateDateTime } = require("./validators.cjs");

const SCHEDULED_POSTS_FILE = "data/scheduledPosts.json";

/**
 * Save a scheduled post
 */
async function saveScheduledPost(post) {
  if (!post.scheduleTime) {
    throw new Error("Schedule date/time is required");
  }

  if (!validateDateTime(post.scheduleTime)) {
    throw new Error("Invalid schedule date/time format");
  }

  const posts = (await readJson(SCHEDULED_POSTS_FILE)) || { posts: [] };
  posts.posts.push({
    ...post,
    id: Date.now().toString(),
    created: new Date().toISOString(),
    posted: false,
  });

  await writeJson(SCHEDULED_POSTS_FILE, posts);
  return posts.posts[posts.posts.length - 1];
}

/**
 * Get all scheduled posts
 */
async function getScheduledPosts() {
  const posts = (await readJson(SCHEDULED_POSTS_FILE)) || { posts: [] };
  return posts.posts;
}

/**
 * Mark a post as posted
 */
async function markPostAsPosted(postId) {
  const posts = (await readJson(SCHEDULED_POSTS_FILE)) || { posts: [] };
  const postIndex = posts.posts.findIndex((p) => p.id === postId);

  if (postIndex === -1) {
    throw new Error("Post not found");
  }

  posts.posts[postIndex].posted = true;
  posts.posts[postIndex].postedAt = new Date().toISOString();

  await writeJson(SCHEDULED_POSTS_FILE, posts);
  return posts.posts[postIndex];
}

module.exports = {
  saveScheduledPost,
  getScheduledPosts,
  markPostAsPosted,
};
