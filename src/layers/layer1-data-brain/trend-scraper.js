/**
 * Trend Scraper
 * 
 * Fetches rising trends from multiple data sources:
 *  1. Google Trends (via SerpAPI)
 *  2. YouTube Autocomplete API
 *  3. Reddit Hot Posts (niche subreddits)
 *  4. Twitter/X Trending Topics
 *
 * Uses velocity scoring to predict trends that will peak in ~72 hours
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { sleep, retry, RateLimiter } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('TrendScraper');

// Rate limiters per API
const serpLimiter = new RateLimiter(10, 60000);      // 10 req/min
const youtubeLimiter = new RateLimiter(30, 60000);   // 30 req/min
const redditLimiter = new RateLimiter(60, 60000);    // 60 req/min

export class TrendScraper {

  /**
   * Fetch all trends for a given niche profile
   */
  static async fetchForNiche(niche, options = {}) {
    log.info(`Fetching trends for niche: ${niche.id}`);

    const [googleTrends, youtubeTrends, redditTrends] = await Promise.allSettled([
      TrendScraper.fetchGoogleTrends(niche),
      TrendScraper.fetchYouTubeAutocomplete(niche),
      TrendScraper.fetchRedditHot(niche)
    ]);

    const allTrends = [
      ...(googleTrends.status === 'fulfilled' ? googleTrends.value : []),
      ...(youtubeTrends.status === 'fulfilled' ? youtubeTrends.value : []),
      ...(redditTrends.status === 'fulfilled' ? redditTrends.value : [])
    ];

    // Deduplicate and merge by keyword similarity
    const merged = TrendScraper.mergeAndDeduplicate(allTrends);

    // Score trend velocity (how fast interest is growing)
    const scored = TrendScraper.scoreTrendVelocity(merged);

    log.info(`Found ${scored.length} trend candidates for ${niche.id}`);
    return scored;
  }

  /**
   * Google Trends via SerpAPI
   * Fetches "Rising" queries in the niche category
   */
  static async fetchGoogleTrends(niche) {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      log.warn('SERPAPI_KEY not set — skipping Google Trends');
      return TrendScraper.mockGoogleTrends(niche);
    }

    await serpLimiter.throttle();

    const results = [];

    for (const seedKeyword of niche.seedKeywords.slice(0, 3)) {
      try {
        const response = await retry(() =>
          axios.get('https://serpapi.com/search', {
            params: {
              engine: 'google_trends',
              q: seedKeyword,
              data_type: 'RELATED_QUERIES',
              geo: process.env.GOOGLE_TRENDS_GEO || 'US',
              api_key: apiKey
            },
            timeout: 15000
          })
        );

        const risingQueries = response.data?.related_queries?.rising || [];

        for (const item of risingQueries) {
          results.push({
            keyword: item.query,
            source: 'google_trends',
            value: item.value === 'Breakout' ? 1000 : parseInt(item.value, 10) || 0,
            trendVelocity: item.value === 'Breakout' ? 1.0 : Math.min(parseInt(item.value, 10) / 1000, 1.0),
            seedKeyword
          });
        }
      } catch (err) {
        log.warn(`Google Trends fetch failed for "${seedKeyword}": ${err.message}`);
      }
    }

    return results;
  }

  /**
   * YouTube Autocomplete — finds what people are actually searching
   * Uses Google's suggestion API endpoint
   */
  static async fetchYouTubeAutocomplete(niche) {
    const results = [];

    // Generate query variations using niche seeds + common modifiers
    const modifiers = ['how to', 'best', 'why', 'what is', 'top', '', '2026', 'vs'];

    for (const seed of niche.seedKeywords.slice(0, 4)) {
      for (const mod of modifiers.slice(0, 4)) {
        const query = mod ? `${mod} ${seed}` : seed;

        await youtubeLimiter.throttle();

        try {
          const response = await retry(() =>
            axios.get('https://suggestqueries-clients6.youtube.com/complete/search', {
              params: {
                client: 'youtube',
                ds: 'yt',
                q: query,
                hl: 'en'
              },
              timeout: 8000
            })
          );

          // YouTube suggestions come back as JSONP — parse manually
          const raw = response.data;
          let suggestions = [];

          if (typeof raw === 'string') {
            const match = raw.match(/\[.*\]/s);
            if (match) {
              const parsed = JSON.parse(match[0]);
              suggestions = (parsed[1] || []).map((s) => s[0]);
            }
          } else if (Array.isArray(raw)) {
            suggestions = (raw[1] || []).map((s) => s[0]);
          }

          for (const suggestion of suggestions) {
            results.push({
              keyword: suggestion,
              source: 'youtube_autocomplete',
              trendVelocity: 0.6,
              searchVolume: 5000,
              seedKeyword: seed
            });
          }
        } catch (err) {
          log.debug(`Autocomplete failed for "${query}": ${err.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Reddit Hot Posts — niche subreddit scraping
   * Extracts titles of top posts to find trending topics
   */
  static async fetchRedditHot(niche) {
    const results = [];

    if (!niche.subreddits || !niche.subreddits.length) {
      return results;
    }

    for (const subreddit of niche.subreddits.slice(0, 3)) {
      await redditLimiter.throttle();

      try {
        const response = await retry(() =>
          axios.get(`https://www.reddit.com/r/${subreddit}/hot.json`, {
            params: { limit: 25 },
            headers: { 'User-Agent': 'CC-OS/1.0 Trend Collector' },
            timeout: 10000
          })
        );

        const posts = response.data?.data?.children || [];

        for (const post of posts) {
          const { title, score, num_comments, upvote_ratio } = post.data;
          const velocity = Math.min((score / 10000) * upvote_ratio, 1.0);

          results.push({
            keyword: title,
            source: 'reddit',
            trendVelocity: velocity,
            searchVolume: Math.round(score * 0.1),
            upvotes: score,
            comments: num_comments,
            subreddit
          });
        }
      } catch (err) {
        log.warn(`Reddit fetch failed for r/${subreddit}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Merge duplicate/similar trends from multiple sources
   * Boosts score when the same topic appears from multiple sources
   */
  static mergeAndDeduplicate(trends) {
    const map = new Map();

    for (const trend of trends) {
      const normalizedKey = trend.keyword.toLowerCase().trim().replace(/\s+/g, ' ');

      if (map.has(normalizedKey)) {
        const existing = map.get(normalizedKey);
        // Boost velocity when seen in multiple sources
        existing.trendVelocity = Math.min(existing.trendVelocity * 1.3, 1.0);
        existing.sources = [...new Set([...(existing.sources || [existing.source]), trend.source])];
        existing.searchVolume = Math.max(existing.searchVolume || 0, trend.searchVolume || 0);
      } else {
        map.set(normalizedKey, {
          ...trend,
          sources: [trend.source]
        });
      }
    }

    return Array.from(map.values());
  }

  /**
   * Score trend velocity — how fast is this topic growing?
   * Higher score = likely to peak sooner (our 72h prediction window)
   */
  static scoreTrendVelocity(trends) {
    return trends.map((trend) => {
      let velocityBoost = 1.0;

      // Multi-source boost
      if (trend.sources && trend.sources.length > 1) velocityBoost += 0.2 * trend.sources.length;

      // Recency signal boost (Reddit posts with high comments = discussion happening NOW)
      if (trend.comments && trend.comments > 500) velocityBoost += 0.15;

      // Breakout detection
      if (trend.trendVelocity === 1.0) velocityBoost += 0.3;

      return {
        ...trend,
        trendVelocity: Math.min(trend.trendVelocity * velocityBoost, 1.0),
        predictedPeakHours: Math.round(24 + (1.0 - trend.trendVelocity) * 48) // 24-72h range
      };
    });
  }

  /**
   * Mock data for development/testing when APIs aren't configured
   */
  static mockGoogleTrends(niche) {
    const mockKeywords = {
      technology: ['AI agents 2026', 'best budget laptop', 'Apple Vision Pro review', 'ChatGPT alternatives'],
      finance: ['passive income 2026', 'crypto bull run', 'index fund strategy', 'recession proof stocks'],
      health: ['morning routine longevity', 'seed cycling benefits', 'cold plunge benefits', 'gut health foods'],
      gaming: ['best games 2026', 'RTX 5090 review', 'indie games hidden gems', 'game pass worth it'],
      cooking: ['air fryer recipes', 'meal prep for beginners', 'viral tiktok recipes', '5 ingredient dinner']
    };

    const templates = mockKeywords[niche.category] || mockKeywords.technology;

    return templates.map((keyword, i) => ({
      keyword,
      source: 'mock_google_trends',
      trendVelocity: 0.7 - i * 0.1,
      searchVolume: 50000 - i * 5000,
      seedKeyword: niche.seedKeywords[0]
    }));
  }
}
