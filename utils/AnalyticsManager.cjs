/**
 * AnalyticsManager.js
 * Utility for managing analytics data tracking and calculations
 */

const { validateAnalytics } = require('./validators.cjs');

class AnalyticsManager {
  /**
   * Record a new post in analytics
   * @param {Object} analyticsData - Current analytics data
   * @param {Object} postData - Post data to record
   * @returns {Object} Updated analytics data
   */
  static recordPost(analyticsData, postData) {
    const data = JSON.parse(JSON.stringify(analyticsData)); // Deep clone

    // Create post entry
    const post = {
      id: postData.id || `post_${Date.now()}`,
      platform: postData.platform,
      timestamp: postData.timestamp || new Date().toISOString(),
      impressions: postData.impressions || 0,
      engagement: postData.engagement || 0,
      clicks: postData.clicks || 0,
      shares: postData.shares || 0,
      likes: postData.likes || 0,
      comments: postData.comments || 0,
      contentType: postData.contentType || 'unknown'
    };

    // Add to posts array
    data.posts.push(post);

    // Update summary
    data.summary = this.calculateSummary(data.posts);
    data.lastUpdated = new Date().toISOString();

    return data;
  }

  /**
   * Update metrics for an existing post
   * @param {Object} analyticsData - Current analytics data
   * @param {string} postId - Post ID to update
   * @param {Object} metrics - Updated metrics
   * @returns {Object} Updated analytics data or null if post not found
   */
  static updatePostMetrics(analyticsData, postId, metrics) {
    const data = JSON.parse(JSON.stringify(analyticsData)); // Deep clone

    const postIndex = data.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      return null;
    }

    // Update metrics
    const post = data.posts[postIndex];
    if (metrics.impressions !== undefined) {
      post.impressions = metrics.impressions;
    }
    if (metrics.engagement !== undefined) {
      post.engagement = metrics.engagement;
    }
    if (metrics.clicks !== undefined) {
      post.clicks = metrics.clicks;
    }
    if (metrics.shares !== undefined) {
      post.shares = metrics.shares;
    }
    if (metrics.likes !== undefined) {
      post.likes = metrics.likes;
    }
    if (metrics.comments !== undefined) {
      post.comments = metrics.comments;
    }

    // Recalculate summary
    data.summary = this.calculateSummary(data.posts);
    data.lastUpdated = new Date().toISOString();

    return data;
  }

  /**
   * Calculate summary statistics from posts array
   * @param {Array} posts - Array of post objects
   * @returns {Object} Summary object
   */
  static calculateSummary(posts) {
    const summary = {
      totalPosts: posts.length,
      totalImpressions: 0,
      totalEngagement: 0,
      avgEngagementRate: 0,
      platforms: {
        instagram: { posts: 0, impressions: 0, engagement: 0 },
        tiktok: { posts: 0, impressions: 0, engagement: 0 },
        youtube: { posts: 0, impressions: 0, engagement: 0 },
        twitter: { posts: 0, impressions: 0, engagement: 0 }
      },
      bestPostingTimes: {
        hourOfDay: {},
        dayOfWeek: {}
      },
      contentTypePerformance: {}
    };

    if (posts.length === 0) {
      return summary;
    }

    // Calculate totals and platform stats
    posts.forEach(post => {
      summary.totalImpressions += post.impressions || 0;
      summary.totalEngagement += post.engagement || 0;

      if (summary.platforms[post.platform]) {
        summary.platforms[post.platform].posts++;
        summary.platforms[post.platform].impressions += post.impressions || 0;
        summary.platforms[post.platform].engagement += post.engagement || 0;
      }

      // Track posting times
      const date = new Date(post.timestamp);
      const hour = date.getHours();
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });

      if (!summary.bestPostingTimes.hourOfDay[hour]) {
        summary.bestPostingTimes.hourOfDay[hour] = { posts: 0, engagement: 0 };
      }
      summary.bestPostingTimes.hourOfDay[hour].posts++;
      summary.bestPostingTimes.hourOfDay[hour].engagement += post.engagement || 0;

      if (!summary.bestPostingTimes.dayOfWeek[day]) {
        summary.bestPostingTimes.dayOfWeek[day] = { posts: 0, engagement: 0 };
      }
      summary.bestPostingTimes.dayOfWeek[day].posts++;
      summary.bestPostingTimes.dayOfWeek[day].engagement += post.engagement || 0;

      // Track content type performance
      const contentType = post.contentType || 'unknown';
      if (!summary.contentTypePerformance[contentType]) {
        summary.contentTypePerformance[contentType] = { posts: 0, engagement: 0, impressions: 0 };
      }
      summary.contentTypePerformance[contentType].posts++;
      summary.contentTypePerformance[contentType].engagement += post.engagement || 0;
      summary.contentTypePerformance[contentType].impressions += post.impressions || 0;
    });

    // Calculate average engagement rate
    if (summary.totalImpressions > 0) {
      summary.avgEngagementRate = (summary.totalEngagement / summary.totalImpressions) * 100;
    }

    return summary;
  }

  /**
   * Get best posting times based on engagement
   * @param {Object} analyticsData - Analytics data
   * @returns {Object} Best times with hours and days ranked by engagement
   */
  static getBestPostingTimes(analyticsData) {
    const { bestPostingTimes } = analyticsData.summary;

    // Rank hours by average engagement
    const hourRankings = Object.entries(bestPostingTimes.hourOfDay)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgEngagement: data.posts > 0 ? data.engagement / data.posts : 0,
        posts: data.posts
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Rank days by average engagement
    const dayRankings = Object.entries(bestPostingTimes.dayOfWeek)
      .map(([day, data]) => ({
        day,
        avgEngagement: data.posts > 0 ? data.engagement / data.posts : 0,
        posts: data.posts
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    return {
      bestHours: hourRankings.slice(0, 5), // Top 5 hours
      bestDays: dayRankings.slice(0, 3)    // Top 3 days
    };
  }

  /**
   * Get engagement rate for a specific platform
   * @param {Object} analyticsData - Analytics data
   * @param {string} platform - Platform name
   * @returns {number} Engagement rate percentage
   */
  static getEngagementRate(analyticsData, platform) {
    const platformStats = analyticsData.summary.platforms[platform];
    if (!platformStats || platformStats.impressions === 0) {
      return 0;
    }
    return (platformStats.engagement / platformStats.impressions) * 100;
  }

  /**
   * Get statistics for a specific platform
   * @param {Object} analyticsData - Analytics data
   * @param {string} platform - Platform name
   * @returns {Object} Platform statistics
   */
  static getPlatformStats(analyticsData, platform) {
    const platformStats = analyticsData.summary.platforms[platform];
    if (!platformStats) {
      return null;
    }

    return {
      platform,
      posts: platformStats.posts,
      impressions: platformStats.impressions,
      engagement: platformStats.engagement,
      engagementRate: this.getEngagementRate(analyticsData, platform),
      avgImpressionsPerPost: platformStats.posts > 0 ? platformStats.impressions / platformStats.posts : 0,
      avgEngagementPerPost: platformStats.posts > 0 ? platformStats.engagement / platformStats.posts : 0
    };
  }

  /**
   * Get posts within a date range
   * @param {Object} analyticsData - Analytics data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Filtered posts
   */
  static getPostsByDateRange(analyticsData, startDate, endDate) {
    return analyticsData.posts.filter(post => {
      const postDate = new Date(post.timestamp);
      return postDate >= startDate && postDate <= endDate;
    });
  }

  /**
   * Get content type performance comparison
   * @param {Object} analyticsData - Analytics data
   * @returns {Array} Content types ranked by engagement
   */
  static getContentTypePerformance(analyticsData) {
    const { contentTypePerformance } = analyticsData.summary;

    return Object.entries(contentTypePerformance)
      .map(([type, data]) => ({
        contentType: type,
        posts: data.posts,
        engagement: data.engagement,
        impressions: data.impressions,
        avgEngagement: data.posts > 0 ? data.engagement / data.posts : 0,
        avgImpressions: data.posts > 0 ? data.impressions / data.posts : 0,
        engagementRate: data.impressions > 0 ? (data.engagement / data.impressions) * 100 : 0
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
  }

  /**
   * Initialize empty analytics data structure
   * @returns {Object} Empty analytics data
   */
  static createEmpty() {
    return {
      posts: [],
      summary: {
        totalPosts: 0,
        totalImpressions: 0,
        totalEngagement: 0,
        avgEngagementRate: 0,
        platforms: {
          instagram: { posts: 0, impressions: 0, engagement: 0 },
          tiktok: { posts: 0, impressions: 0, engagement: 0 },
          youtube: { posts: 0, impressions: 0, engagement: 0 },
          twitter: { posts: 0, impressions: 0, engagement: 0 }
        },
        bestPostingTimes: {
          hourOfDay: {},
          dayOfWeek: {}
        },
        contentTypePerformance: {}
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Validate analytics data structure
   * @param {Object} data - Data to validate
   * @returns {Object} Validation result { valid: boolean, error?: string }
   */
  static validate(data) {
    return validateAnalytics(data);
  }
}

module.exports = AnalyticsManager;
