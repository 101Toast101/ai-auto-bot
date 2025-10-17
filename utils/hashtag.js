// ========================================
// utils/hashtag.js
// ========================================
// Relevant hashtags by content type
const hashtagSets = {
  meme: ['meme', 'funny', 'humor', 'comedy', 'viral', 'trending', 'memesdaily', 'relatable', 'lol', 'jokes'],
  video: ['video', 'viral', 'reels', 'shortform', 'trending', 'viralvideo', 'content', 'creator', 'social', 'media'],
  text: ['quotes', 'wisdom', 'thoughts', 'motivation', 'inspiration', 'facts', 'didyouknow', 'knowledge', 'truth', 'learning']
};

function parseHashtagsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  const cleaned = raw.map(s => s.startsWith('#') ? s.slice(1) : s);
  return cleaned.filter(Boolean).map(s => s.replace(/[^\w-]/g, '')).filter(Boolean);
}

function generateAutoHashtags(contentType = 'meme', content = '') {
  // Get base hashtags for content type
  const baseHashtags = hashtagSets[contentType] || hashtagSets.meme;
  
  // Add any meaningful words from content as hashtags (if text content exists)
  let contentWords = [];
  if (content) {
    contentWords = content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3) // Only words longer than 3 chars
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => !['this', 'that', 'when', 'what', 'where', 'which', 'with'].includes(word));
  }
  
  // Combine and remove duplicates
  const allTags = [...new Set([...baseHashtags, ...contentWords])];
  
  // Return top 10 hashtags
  return allTags.slice(0, 10);
}

function formatHashtags(list, maxCount = 30) {
  if (!Array.isArray(list)) return '';
  const cleaned = list.map(s => String(s).trim()).filter(Boolean).slice(0, maxCount);
  return cleaned.map(s => s.startsWith('#') ? s : `#${s}`).join(' ');
}

function validateHashtags(list, { min = 0, max = 30 } = {}) {
  if (!Array.isArray(list)) return { valid: false, errors: ['Hashtags must be an array'] };
  const errors = [];
  if (list.length < min) errors.push(`At least ${min} hashtags required`);
  if (list.length > max) errors.push(`No more than ${max} hashtags allowed`);
  const invalid = list.filter(s => typeof s !== 'string' || s.trim().length === 0);
  if (invalid.length) errors.push('All hashtags must be non-empty strings');
  return { valid: errors.length === 0, errors };
}

module.exports = {
  parseHashtagsFromText,
  formatHashtags,
  validateHashtags,
  generateAutoHashtags
};