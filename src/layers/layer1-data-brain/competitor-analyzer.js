/**
 * Competitor Analyzer
 *
 * Analyzes competitor channels and videos to extract:
 *  - Title patterns that drive high CTR
 *  - Thumbnail styles that attract clicks
 *  - Optimal video lengths for the niche
 *  - Comment patterns that drive engagement
 *  - Upload frequency and schedule patterns
 *  - Tag strategies
 */

import axios from 'axios';
import { retry, sleep, RateLimiter } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('CompetitorAnalyzer');
const ytLimiter = new RateLimiter(20, 60000);

export class CompetitorAnalyzer {

  /**
   * Search for top competitor videos for a keyword
   * Returns structured analysis of top 10 results
   */
  static async analyzeTopVideos(keyword, niche) {
    log.info(`Analyzing competitors for: "${keyword}"`);

    const apiKey = process.env.RAPIDAPI_KEY;
    let videos = [];

    if (apiKey) {
      videos = await CompetitorAnalyzer.fetchViaRapidAPI(keyword, apiKey);
    } else {
      log.warn('RAPIDAPI_KEY not set — using mock competitor data');
      videos = CompetitorAnalyzer.mockCompetitorVideos(keyword, niche);
    }

    // Analyze patterns across top 10
    const analysis = {
      keyword,
      topVideos: videos.slice(0, 10),
      titlePatterns: CompetitorAnalyzer.extractTitlePatterns(videos),
      avgDuration: CompetitorAnalyzer.calcAvgDuration(videos),
      avgViews: CompetitorAnalyzer.calcAvgViews(videos),
      topTags: CompetitorAnalyzer.extractTopTags(videos),
      thumbnailInsights: CompetitorAnalyzer.analyzeThumbnailPatterns(videos),
      contentGaps: CompetitorAnalyzer.findContentGaps(videos, niche),
      recommendedLength: CompetitorAnalyzer.recommendLength(videos, niche),
      analyzedAt: new Date().toISOString()
    };

    log.info(`Competitor analysis complete: ${videos.length} videos analyzed`);
    return analysis;
  }

  static async fetchViaRapidAPI(keyword, apiKey) {
    await ytLimiter.throttle();

    try {
      const response = await retry(() =>
        axios.get('https://youtube-search-results.p.rapidapi.com/youtube-search/', {
          params: { q: keyword, type: 'video' },
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'youtube-search-results.p.rapidapi.com'
          },
          timeout: 10000
        })
      );

      return (response.data?.items || []).map((v) => ({
        videoId: v.id,
        title: v.title,
        channelName: v.channelTitle,
        views: parseInt(v.viewCount, 10) || 0,
        duration: v.duration || '00:10:00',
        durationSeconds: CompetitorAnalyzer.parseDuration(v.duration || '00:10:00'),
        thumbnail: v.thumbnail?.url || '',
        publishedAt: v.publishedAt,
        tags: v.tags || [],
        description: v.description || ''
      }));
    } catch (err) {
      log.warn(`RapidAPI fetch failed: ${err.message}`);
      return [];
    }
  }

  static parseDuration(duration) {
    // Parse ISO 8601 or HH:MM:SS
    if (duration.includes('PT')) {
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
      }
    }
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 600;
  }

  static extractTitlePatterns(videos) {
    const patterns = {
      usesNumbers: 0,
      usesYear: 0,
      usesQuestion: 0,
      usesAllCaps: 0,
      avgWordCount: 0,
      commonPrefixes: {},
      commonWords: {}
    };

    for (const v of videos) {
      const title = v.title || '';
      if (/\d+/.test(title)) patterns.usesNumbers++;
      if (/202[0-9]/.test(title)) patterns.usesYear++;
      if (/\?/.test(title)) patterns.usesQuestion++;
      if (/[A-Z]{3,}/.test(title)) patterns.usesAllCaps++;

      const words = title.toLowerCase().split(/\s+/);
      patterns.avgWordCount += words.length;

      if (words.length > 0) {
        const prefix = words.slice(0, 2).join(' ');
        patterns.commonPrefixes[prefix] = (patterns.commonPrefixes[prefix] || 0) + 1;
      }

      for (const word of words) {
        if (word.length > 4) {
          patterns.commonWords[word] = (patterns.commonWords[word] || 0) + 1;
        }
      }
    }

    const n = videos.length || 1;
    patterns.avgWordCount = Math.round(patterns.avgWordCount / n);
    patterns.topPrefixes = Object.entries(patterns.commonPrefixes)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    patterns.topWords = Object.entries(patterns.commonWords)
      .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);

    return patterns;
  }

  static calcAvgDuration(videos) {
    if (!videos.length) return 600;
    const total = videos.reduce((s, v) => s + (v.durationSeconds || 600), 0);
    return Math.round(total / videos.length);
  }

  static calcAvgViews(videos) {
    if (!videos.length) return 0;
    const total = videos.reduce((s, v) => s + (v.views || 0), 0);
    return Math.round(total / videos.length);
  }

  static extractTopTags(videos) {
    const tagCount = {};
    for (const v of videos) {
      for (const tag of v.tags || []) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      }
    }
    return Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t);
  }

  static analyzeThumbnailPatterns(videos) {
    return {
      note: 'Full thumbnail CV analysis requires image processing. Basic patterns extracted.',
      hasThumbnails: videos.filter((v) => v.thumbnail).length,
      totalVideos: videos.length
    };
  }

  static findContentGaps(videos, niche) {
    // Find subtopics that appear in niche seed keywords but not in competitor titles
    const competitorContent = videos.map((v) => v.title.toLowerCase()).join(' ');
    const gaps = [];

    for (const keyword of niche.seedKeywords || []) {
      const variations = [`beginner ${keyword}`, `${keyword} mistakes`, `${keyword} 2026`, `${keyword} tips`];
      for (const variation of variations) {
        if (!competitorContent.includes(keyword.toLowerCase())) {
          gaps.push(variation);
        }
      }
    }

    return [...new Set(gaps)].slice(0, 8);
  }

  static recommendLength(videos, niche) {
    const avg = CompetitorAnalyzer.calcAvgDuration(videos);
    const target = niche.targetVideoDurationMinutes * 60;

    // If competitors average less than target, stay near average
    // If competitors are very long, go slightly shorter for better retention %
    if (avg < target) return Math.round(avg * 1.1);
    if (avg > target * 1.5) return Math.round(target * 0.9);
    return target;
  }

  static mockCompetitorVideos(keyword, niche) {
    const titles = [
      `The COMPLETE ${keyword} Guide (2026)`,
      `${keyword} Explained in 10 Minutes`,
      `Why Everyone is Wrong About ${keyword}`,
      `${keyword}: Beginner to Pro`,
      `I Tried ${keyword} for 30 Days — Results`,
      `Top 10 ${keyword} Tips Nobody Talks About`,
      `${keyword} vs. Everything Else (Honest Review)`,
      `How to Master ${keyword} in 2026`,
      `The ${keyword} Mistake 90% of People Make`,
      `${keyword} Full Tutorial — Step by Step`
    ];

    return titles.map((title, i) => ({
      videoId: `mock_${i}`,
      title,
      channelName: `${niche.category} Channel ${i + 1}`,
      views: 50000 + Math.random() * 500000,
      durationSeconds: 400 + Math.random() * 800,
      thumbnail: '',
      publishedAt: new Date(Date.now() - i * 7 * 24 * 3600 * 1000).toISOString(),
      tags: niche.seedKeywords || [],
      description: `A video about ${keyword}`
    }));
  }
}
