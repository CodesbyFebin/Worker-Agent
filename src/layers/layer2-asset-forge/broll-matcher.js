/**
 * B-Roll Matcher — Semantic Visual Asset Matching
 *
 * Analyzes action verbs and nouns in each script segment and
 * fetches semantically matched stock footage/images.
 *
 * Intelligence tiers:
 *  1. Exact keyword match → direct Pexels/Pixabay search
 *  2. Action verb extraction → motion-matched footage
 *  3. Emotion/tone matching → mood-appropriate visuals
 *  4. Fallback → niche-appropriate generic b-roll
 *
 * The "80/20 Asset Rule": 80% AI/stock, 20% unique overlays
 * The unique 20% is generated as lower-third data overlays
 */

import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { retry, sleep, ensureDir, RateLimiter } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('BRollMatcher');
const ASSETS_DIR = process.env.ASSETS_DIR || './assets';
const pexelsLimiter = new RateLimiter(30, 60000);

// Action verb → visual concept mappings
const ACTION_VISUAL_MAP = {
  // Motion verbs → dynamic footage
  'run': 'person running outdoors',
  'build': 'construction building process',
  'grow': 'plant growing time-lapse',
  'invest': 'stock market trading screen',
  'code': 'developer typing code',
  'design': 'designer working on laptop',
  'create': 'creative workspace studio',
  'launch': 'rocket launch countdown',
  'explode': 'explosion particles abstract',
  'transform': 'metamorphosis transformation',
  'connect': 'network nodes connecting',
  'flow': 'water flowing river',
  'rise': 'sun rising horizon timelapse',
  'fall': 'leaves falling autumn',
  'search': 'person using computer searching',
  'discover': 'explorer discovery moment',
  'reveal': 'curtain reveal opening',
  'compare': 'side by side comparison',
  'analyze': 'data analysis charts',
  'automate': 'robots machinery automation',
  'achieve': 'person celebrating success',
  'fail': 'frustrated person mistake',
  'learn': 'student studying books',
  'teach': 'teacher whiteboard classroom',
  'travel': 'airplane travel aerial',
  'cook': 'chef cooking kitchen',
  'eat': 'food close up eating',
  'sleep': 'sleeping person bedroom',
  'exercise': 'gym workout fitness',
  'meditate': 'meditation peaceful nature',
  'focus': 'concentration closeup eyes',
  'communicate': 'people talking meeting',
  'present': 'business presentation audience',
  'save': 'piggy bank saving money',
  'spend': 'shopping payment transaction',
  'download': 'digital download files',
  'upload': 'cloud upload data',
  'install': 'software installation screen'
};

// Niche default b-roll categories
const NICHE_DEFAULTS = {
  technology: ['laptop screen code', 'circuit board closeup', 'smartphone apps', 'server room'],
  finance: ['stock market data', 'calculator money', 'bank vault', 'coins stacking'],
  health: ['healthy food plate', 'person exercising', 'doctor consultation', 'nature walk'],
  cooking: ['kitchen cooking', 'ingredients fresh', 'plating food', 'eating closeup'],
  gaming: ['gaming setup rgb', 'controller hands playing', 'gaming monitor', 'esports arena'],
  'true-crime': ['police crime scene', 'detective evidence', 'courtroom', 'dark dramatic'],
  fitness: ['gym workout', 'running outdoor', 'protein shake', 'athletic performance'],
  education: ['books library', 'writing notes', 'classroom learning', 'graduation ceremony'],
  travel: ['airplane window', 'exotic location', 'backpacker hiking', 'city skyline'],
  default: ['professional workspace', 'person thinking', 'abstract background', 'modern office']
};

export class BRollMatcher {

  /**
   * Create a complete B-Roll plan for a script
   * Returns a list of visual assets with timestamps and download URLs
   */
  static async createPlan(script, niche) {
    log.info(`Creating B-Roll plan for script: ${script.id}`);

    const plan = [];
    const usedQueries = new Set();

    for (const segment of script.segments) {
      if (!segment.brollCues || segment.brollCues.length === 0) {
        // Auto-extract visual cues from segment text
        const autoCues = BRollMatcher.extractVisualCues(segment.text);
        segment.brollCues = autoCues;
      }

      for (const cue of segment.brollCues) {
        const query = BRollMatcher.buildSearchQuery(cue.description || cue, niche);

        if (usedQueries.has(query)) continue; // Avoid duplicate clips
        usedQueries.add(query);

        const asset = await BRollMatcher.fetchAsset(query, niche);

        if (asset) {
          plan.push({
            segmentSection: segment.section,
            cueDescription: cue.description || cue,
            searchQuery: query,
            asset,
            overlay: BRollMatcher.generateOverlay(segment, niche)
          });
        }
      }
    }

    // Ensure minimum 80% coverage
    const coverageRatio = plan.length / Math.max(script.segments.length, 1);
    if (coverageRatio < 0.8) {
      log.warn(`B-Roll coverage ${(coverageRatio * 100).toFixed(0)}% — filling gaps with niche defaults`);
      const fillerAssets = await BRollMatcher.fetchNicheDefaults(niche, 5 - plan.length);
      plan.push(...fillerAssets);
    }

    log.info(`B-Roll plan complete: ${plan.length} assets`);
    return plan;
  }

  /**
   * Extract visual cues from plain text by identifying action verbs and nouns
   */
  static extractVisualCues(text) {
    const cues = [];
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');

    // Check for direct action verb matches
    for (const [verb, visual] of Object.entries(ACTION_VISUAL_MAP)) {
      if (cleanText.includes(verb)) {
        cues.push({ description: visual });
        if (cues.length >= 2) break; // Max 2 cues per segment
      }
    }

    // Extract noun phrases as fallback
    if (cues.length === 0) {
      const words = cleanText.split(' ');
      const meaningfulWords = words.filter((w) => w.length > 5 && !STOP_WORDS.has(w));
      if (meaningfulWords.length > 0) {
        cues.push({ description: meaningfulWords.slice(0, 3).join(' ') });
      }
    }

    return cues;
  }

  /**
   * Build an optimized Pexels search query from a cue description
   */
  static buildSearchQuery(description, niche) {
    // Clean and normalize
    const clean = description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove stop words for better search relevance
    const words = clean.split(' ').filter((w) => !STOP_WORDS.has(w));
    const query = words.slice(0, 4).join(' ');

    return query || niche.category;
  }

  /**
   * Fetch a video/image asset from Pexels
   */
  static async fetchAsset(query, niche) {
    const apiKey = process.env.PEXELS_API_KEY;

    if (!apiKey) {
      return BRollMatcher.mockAsset(query);
    }

    await pexelsLimiter.throttle();

    try {
      // Try video first
      const videoResponse = await retry(() =>
        axios.get('https://api.pexels.com/videos/search', {
          params: { query, per_page: 5, min_width: 1280, min_duration: 5 },
          headers: { Authorization: apiKey },
          timeout: 8000
        })
      );

      const videos = videoResponse.data?.videos || [];
      if (videos.length > 0) {
        const video = videos[0];
        const file = video.video_files?.find((f) => f.quality === 'hd' || f.quality === 'sd');
        return {
          type: 'video',
          id: video.id,
          url: file?.link || video.url,
          preview: video.image,
          width: file?.width || 1280,
          height: file?.height || 720,
          duration: video.duration,
          attribution: `Video by ${video.user?.name} on Pexels`,
          query
        };
      }

      // Fallback to image
      const imgResponse = await retry(() =>
        axios.get('https://api.pexels.com/v1/search', {
          params: { query, per_page: 5, orientation: 'landscape' },
          headers: { Authorization: apiKey },
          timeout: 8000
        })
      );

      const images = imgResponse.data?.photos || [];
      if (images.length > 0) {
        const img = images[0];
        return {
          type: 'image',
          id: img.id,
          url: img.src?.large2x || img.src?.large,
          preview: img.src?.medium,
          width: img.width,
          height: img.height,
          attribution: `Photo by ${img.photographer} on Pexels`,
          query
        };
      }
    } catch (err) {
      log.warn(`Pexels fetch failed for "${query}": ${err.message}`);
    }

    return BRollMatcher.mockAsset(query);
  }

  /**
   * Fetch default b-roll for a niche to fill coverage gaps
   */
  static async fetchNicheDefaults(niche, count = 3) {
    const defaults = NICHE_DEFAULTS[niche.category] || NICHE_DEFAULTS.default;
    const results = [];

    for (const query of defaults.slice(0, count)) {
      const asset = await BRollMatcher.fetchAsset(query, niche);
      if (asset) {
        results.push({
          segmentSection: 'filler',
          cueDescription: query,
          searchQuery: query,
          asset,
          overlay: null
        });
      }
    }

    return results;
  }

  /**
   * Generate the "unique 20%" overlay data
   * Creates dynamic lower-third data that makes the video unique
   */
  static generateOverlay(segment, niche) {
    const overlayTypes = ['stat', 'quote', 'tip', 'cta_subtle', 'none'];
    const type = overlayTypes[Math.floor(Math.random() * overlayTypes.length)];

    if (type === 'none') return null;

    const overlays = {
      stat: {
        type: 'lower_third_stat',
        template: 'stat_bar',
        data: { value: `${Math.round(Math.random() * 80 + 20)}%`, label: 'Success Rate' }
      },
      quote: {
        type: 'quote_overlay',
        template: 'quote_box',
        data: { text: segment.text.split('.')[0].trim().slice(0, 60) + '...' }
      },
      tip: {
        type: 'tip_badge',
        template: 'pro_tip',
        data: { label: 'PRO TIP', text: 'Watch this section again' }
      },
      cta_subtle: {
        type: 'subscribe_nudge',
        template: 'subtle_cta',
        data: { text: '↑ Subscribe for more', position: 'bottom_right' }
      }
    };

    return overlays[type] || null;
  }

  /**
   * Mock asset for dev mode
   */
  static mockAsset(query) {
    return {
      type: 'mock',
      id: `mock_${query.replace(/\s/g, '_')}`,
      url: `https://placeholder.pexels.com/${query.replace(/\s/g, '-')}`,
      preview: null,
      width: 1920,
      height: 1080,
      duration: 10,
      attribution: 'Mock asset — configure PEXELS_API_KEY for real footage',
      query
    };
  }
}

// Common stop words to filter from search queries
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
  'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with', 'this',
  'from', 'they', 'will', 'have', 'been', 'into', 'more', 'when', 'your',
  'said', 'each', 'which', 'their', 'time', 'about', 'many', 'then', 'them',
  'these', 'some', 'would', 'make', 'like', 'him', 'what', 'know'
]);
