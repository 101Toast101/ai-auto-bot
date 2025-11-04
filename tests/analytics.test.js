/**
 * Test suite for analytics validation and AnalyticsManager
 */

const { validateAnalytics } = require('../utils/validators.cjs');
const AnalyticsManager = require('../utils/AnalyticsManager.cjs');

describe('validateAnalytics', () => {
  test('accepts valid empty analytics data', () => {
    const data = AnalyticsManager.createEmpty();
    const result = validateAnalytics(data);
    expect(result.valid).toBe(true);
  });

  test('accepts valid analytics with posts', () => {
    const data = {
      posts: [
        {
          id: 'post_123',
          platform: 'instagram',
          timestamp: '2025-11-03T12:00:00.000Z',
          impressions: 1000,
          engagement: 50,
          clicks: 10,
          shares: 5,
          likes: 40,
          comments: 5,
          contentType: 'meme'
        }
      ],
      summary: {
        totalPosts: 1,
        totalImpressions: 1000,
        totalEngagement: 50,
        avgEngagementRate: 5.0,
        platforms: {
          instagram: { posts: 1, impressions: 1000, engagement: 50 },
          tiktok: { posts: 0, impressions: 0, engagement: 0 },
          youtube: { posts: 0, impressions: 0, engagement: 0 },
          twitter: { posts: 0, impressions: 0, engagement: 0 }
        },
        bestPostingTimes: {
          hourOfDay: { '12': { posts: 1, engagement: 50 } },
          dayOfWeek: { 'Sunday': { posts: 1, engagement: 50 } }
        },
        contentTypePerformance: {
          meme: { posts: 1, engagement: 50, impressions: 1000 }
        }
      },
      lastUpdated: '2025-11-03T12:00:00.000Z'
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(true);
  });

  test('rejects analytics data that is not an object', () => {
    const result = validateAnalytics('not an object');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be an object');
  });

  test('rejects analytics with dangerous keys', () => {
    const data = {
      constructor: { polluted: true },
      posts: [],
      summary: {}
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dangerous keys');
  });

  test('rejects analytics without posts array', () => {
    const data = {
      summary: {},
      lastUpdated: '2025-11-03T12:00:00.000Z'
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('posts must be an array');
  });

  test('rejects post without id', () => {
    const data = {
      posts: [
        {
          platform: 'instagram',
          timestamp: '2025-11-03T12:00:00.000Z'
        }
      ],
      summary: {}
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing id');
  });

  test('rejects post with invalid platform', () => {
    const data = {
      posts: [
        {
          id: 'post_123',
          platform: 'invalid_platform',
          timestamp: '2025-11-03T12:00:00.000Z'
        }
      ],
      summary: {}
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid platform');
  });

  test('rejects post with invalid timestamp', () => {
    const data = {
      posts: [
        {
          id: 'post_123',
          platform: 'instagram',
          timestamp: 'not a valid date'
        }
      ],
      summary: {}
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid timestamp');
  });

  test('rejects post with negative metrics', () => {
    const data = {
      posts: [
        {
          id: 'post_123',
          platform: 'instagram',
          timestamp: '2025-11-03T12:00:00.000Z',
          impressions: -100
        }
      ],
      summary: {}
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid impressions');
  });

  test('rejects analytics without summary object', () => {
    const data = {
      posts: []
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('summary must be an object');
  });

  test('rejects summary with negative totalPosts', () => {
    const data = {
      posts: [],
      summary: {
        totalPosts: -1,
        totalImpressions: 0,
        totalEngagement: 0,
        avgEngagementRate: 0
      }
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('totalPosts');
  });

  test('rejects invalid lastUpdated', () => {
    const data = {
      posts: [],
      summary: {
        totalPosts: 0,
        totalImpressions: 0,
        totalEngagement: 0,
        avgEngagementRate: 0
      },
      lastUpdated: 'not a date'
    };
    const result = validateAnalytics(data);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lastUpdated');
  });
});

describe('AnalyticsManager', () => {
  describe('createEmpty', () => {
    test('creates valid empty analytics structure', () => {
      const data = AnalyticsManager.createEmpty();
      expect(data.posts).toEqual([]);
      expect(data.summary.totalPosts).toBe(0);
      expect(validateAnalytics(data).valid).toBe(true);
    });
  });

  describe('recordPost', () => {
    test('adds post to analytics and updates summary', () => {
      const initialData = AnalyticsManager.createEmpty();
      const postData = {
        id: 'post_123',
        platform: 'instagram',
        impressions: 100,
        engagement: 10,
        contentType: 'meme'
      };

      const updatedData = AnalyticsManager.recordPost(initialData, postData);

      expect(updatedData.posts.length).toBe(1);
      expect(updatedData.posts[0].id).toBe('post_123');
      expect(updatedData.summary.totalPosts).toBe(1);
      expect(updatedData.summary.totalImpressions).toBe(100);
      expect(updatedData.summary.totalEngagement).toBe(10);
      expect(validateAnalytics(updatedData).valid).toBe(true);
    });

    test('generates ID if not provided', () => {
      const initialData = AnalyticsManager.createEmpty();
      const postData = {
        platform: 'tiktok',
        contentType: 'video'
      };

      const updatedData = AnalyticsManager.recordPost(initialData, postData);

      expect(updatedData.posts[0].id).toMatch(/^post_\d+$/);
    });
  });

  describe('updatePostMetrics', () => {
    test('updates metrics for existing post', () => {
      let data = AnalyticsManager.createEmpty();
      data = AnalyticsManager.recordPost(data, {
        id: 'post_123',
        platform: 'instagram',
        impressions: 100,
        engagement: 10
      });

      const updatedData = AnalyticsManager.updatePostMetrics(data, 'post_123', {
        impressions: 200,
        engagement: 25
      });

      expect(updatedData).not.toBeNull();
      expect(updatedData.posts[0].impressions).toBe(200);
      expect(updatedData.posts[0].engagement).toBe(25);
      expect(updatedData.summary.totalImpressions).toBe(200);
      expect(updatedData.summary.totalEngagement).toBe(25);
    });

    test('returns null if post not found', () => {
      const data = AnalyticsManager.createEmpty();
      const result = AnalyticsManager.updatePostMetrics(data, 'nonexistent', { impressions: 100 });
      expect(result).toBeNull();
    });
  });

  describe('calculateSummary', () => {
    test('calculates correct totals', () => {
      const posts = [
        {
          id: '1',
          platform: 'instagram',
          timestamp: '2025-11-03T12:00:00.000Z',
          impressions: 100,
          engagement: 10,
          contentType: 'meme'
        },
        {
          id: '2',
          platform: 'tiktok',
          timestamp: '2025-11-03T15:00:00.000Z',
          impressions: 200,
          engagement: 30,
          contentType: 'video'
        }
      ];

      const summary = AnalyticsManager.calculateSummary(posts);

      expect(summary.totalPosts).toBe(2);
      expect(summary.totalImpressions).toBe(300);
      expect(summary.totalEngagement).toBe(40);
      expect(summary.avgEngagementRate).toBeCloseTo(13.33, 1);
    });

    test('handles empty posts array', () => {
      const summary = AnalyticsManager.calculateSummary([]);
      expect(summary.totalPosts).toBe(0);
      expect(summary.totalImpressions).toBe(0);
      expect(summary.totalEngagement).toBe(0);
      expect(summary.avgEngagementRate).toBe(0);
    });
  });

  describe('getBestPostingTimes', () => {
    test('ranks hours and days by engagement', () => {
      const data = AnalyticsManager.createEmpty();

      // Add posts at different times
      const posts = [
        { platform: 'instagram', timestamp: '2025-11-03T12:00:00.000Z', engagement: 50 }, // Sunday, 12pm
        { platform: 'instagram', timestamp: '2025-11-04T09:00:00.000Z', engagement: 30 }, // Monday, 9am
        { platform: 'instagram', timestamp: '2025-11-04T12:00:00.000Z', engagement: 70 }, // Monday, 12pm
      ];

      posts.forEach(post => {
        data.posts.push({ id: `post_${Date.now()}`, ...post, impressions: 100, contentType: 'meme' });
      });
      data.summary = AnalyticsManager.calculateSummary(data.posts);

      const bestTimes = AnalyticsManager.getBestPostingTimes(data);

      expect(bestTimes.bestHours.length).toBeGreaterThan(0);
      expect(bestTimes.bestDays.length).toBeGreaterThan(0);
      expect(bestTimes.bestHours[0].avgEngagement).toBeGreaterThanOrEqual(bestTimes.bestHours[1].avgEngagement);
    });
  });

  describe('getPlatformStats', () => {
    test('calculates platform-specific stats', () => {
      let data = AnalyticsManager.createEmpty();
      data = AnalyticsManager.recordPost(data, {
        platform: 'instagram',
        impressions: 100,
        engagement: 10
      });
      data = AnalyticsManager.recordPost(data, {
        platform: 'instagram',
        impressions: 200,
        engagement: 20
      });

      const stats = AnalyticsManager.getPlatformStats(data, 'instagram');

      expect(stats.platform).toBe('instagram');
      expect(stats.posts).toBe(2);
      expect(stats.impressions).toBe(300);
      expect(stats.engagement).toBe(30);
      expect(stats.engagementRate).toBe(10);
      expect(stats.avgImpressionsPerPost).toBe(150);
      expect(stats.avgEngagementPerPost).toBe(15);
    });

    test('returns null for invalid platform', () => {
      const data = AnalyticsManager.createEmpty();
      const stats = AnalyticsManager.getPlatformStats(data, 'invalid_platform');
      expect(stats).toBeNull();
    });
  });

  describe('getContentTypePerformance', () => {
    test('ranks content types by engagement', () => {
      let data = AnalyticsManager.createEmpty();
      data = AnalyticsManager.recordPost(data, {
        platform: 'instagram',
        contentType: 'meme',
        impressions: 100,
        engagement: 20
      });
      data = AnalyticsManager.recordPost(data, {
        platform: 'tiktok',
        contentType: 'video',
        impressions: 200,
        engagement: 30
      });

      const performance = AnalyticsManager.getContentTypePerformance(data);

      expect(performance.length).toBe(2);
      expect(performance[0].contentType).toBe('video'); // Higher engagement
      expect(performance[0].avgEngagement).toBe(30);
      expect(performance[1].contentType).toBe('meme');
      expect(performance[1].avgEngagement).toBe(20);
    });
  });

  describe('validate', () => {
    test('validates analytics data', () => {
      const validData = AnalyticsManager.createEmpty();
      const result = AnalyticsManager.validate(validData);
      expect(result.valid).toBe(true);
    });

    test('rejects invalid data', () => {
      const invalidData = { posts: 'not an array' };
      const result = AnalyticsManager.validate(invalidData);
      expect(result.valid).toBe(false);
    });
  });
});
