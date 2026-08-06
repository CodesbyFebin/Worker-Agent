/**
 * Fingerprint Rotator
 *
 * Ensures each of the 10 channels operates with a completely distinct
 * digital identity to prevent cross-channel shadow bans and pattern detection.
 *
 * What makes each channel "fingerprint-unique":
 *  1. Distinct browser profile (User-Agent, viewport, language settings)
 *  2. Separate OAuth token with isolated cookie jar
 *  3. Unique upload timing patterns (no two channels have same schedule)
 *  4. Distinct metadata patterns (different title structures per channel)
 *  5. Different interaction delays (simulates human variation)
 *  6. Channel-specific writing voice (enforced through niche profiles)
 *
 * Integration points:
 *  - Playwright browser profiles (isolated for each channel)
 *  - Per-channel OAuth token management
 *  - Request header randomization
 *
 * Note: This system uses YouTube's official Data API v3 for uploads.
 * Playwright is only used for analytics scraping where API quotas are limiting.
 */

import path from 'path';
import crypto from 'crypto';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('FingerprintRotator');
const FINGERPRINTS_DIR = './data/analytics';

// Browser user agents pool — rotate per channel
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
];

// Viewport sizes (distinct per channel)
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 2560, height: 1440 },
  { width: 1280, height: 800 },
  { width: 1600, height: 900 },
  { width: 1024, height: 768 },
  { width: 1920, height: 1200 },
  { width: 1280, height: 1024 },
  { width: 1680, height: 1050 }
];

// Language/locale variations
const LOCALES = [
  'en-US', 'en-GB', 'en-CA', 'en-AU', 'en-US',
  'en-US', 'en-GB', 'en-US', 'en-CA', 'en-US'
];

// Timezone variations (distinct per channel)
const TIMEZONES = [
  'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'America/Denver', 'Europe/Berlin',
  'Asia/Kolkata', 'Australia/Sydney', 'America/Toronto', 'Asia/Tokyo'
];

export class FingerprintRotator {

  /**
   * Get the fingerprint profile for a specific channel
   * Returns consistent, deterministic values for each channel ID
   */
  static getProfile(channelId) {
    const idx = (parseInt(channelId, 10) - 1) % 10;
    const profilePath = path.join(FINGERPRINTS_DIR, `fingerprint_${channelId}.json`);

    // Load existing profile or generate new one
    let profile = readJSON(profilePath);

    if (!profile) {
      profile = FingerprintRotator.generateProfile(channelId, idx);
      ensureDir(FINGERPRINTS_DIR);
      writeJSON(profilePath, profile);
      log.debug(`Generated new fingerprint for channel ${channelId}`);
    }

    return profile;
  }

  /**
   * Generate a deterministic fingerprint profile for a channel
   */
  static generateProfile(channelId, idx) {
    // Use channel ID as seed for deterministic but unique values
    const seed = parseInt(channelId, 10) * 7919; // Prime multiplier for distribution

    return {
      channelId,
      userAgent: USER_AGENTS[idx],
      viewport: VIEWPORTS[idx],
      locale: LOCALES[idx],
      timezone: TIMEZONES[idx],

      // Interaction delay ranges (ms) — simulates unique human typing speed
      typingDelayRange: {
        min: 80 + (seed % 60),
        max: 200 + (seed % 100)
      },

      // Click delay before interactions (ms)
      clickDelay: 300 + (seed % 700),

      // Scroll behavior
      scrollBehavior: ['smooth', 'instant', 'auto'][idx % 3],

      // Request headers variation
      acceptLanguage: LOCALES[idx] + ',en;q=0.9',
      dnt: idx % 3 === 0 ? '1' : '0', // Do Not Track — varies

      // Upload timing micro-variation (0-15 minutes random offset)
      uploadTimeJitterMinutes: (seed % 16),

      // Browser profile directory (for Playwright)
      profileDir: `./browser-profiles/channel_${channelId}`,

      // Unique description signature (appended to all descriptions)
      // Slightly different formatting per channel to avoid identical footprints
      descriptionStyle: {
        usesEmoji: idx % 2 === 0,
        bulletStyle: ['-', '•', '→', '✅'][idx % 4],
        ctaPosition: idx % 2 === 0 ? 'top' : 'bottom',
        linkFormat: idx % 2 === 0 ? 'full' : 'shortened'
      },

      // Title capitalization style
      titleStyle: {
        usesAllCaps: idx % 3 === 0,
        capitalizationPattern: ['Title Case', 'FIRST WORD CAPS', 'title case'][idx % 3]
      },

      createdAt: new Date().toISOString(),
      version: 1
    };
  }

  /**
   * Rotate / refresh a fingerprint profile
   * Called every 30 days to maintain freshness
   */
  static async rotate(channelId) {
    const profilePath = path.join(FINGERPRINTS_DIR, `fingerprint_${channelId}.json`);
    const existing = readJSON(profilePath);

    if (!existing) {
      return FingerprintRotator.getProfile(channelId);
    }

    // Rotate the user agent and minor parameters while keeping stable ones
    const idx = (parseInt(channelId, 10) - 1) % 10;
    const newAgentIdx = (idx + Math.floor(Date.now() / (30 * 24 * 3600 * 1000))) % USER_AGENTS.length;

    const rotated = {
      ...existing,
      userAgent: USER_AGENTS[newAgentIdx],
      clickDelay: existing.clickDelay + (Math.floor(Math.random() * 100) - 50),
      uploadTimeJitterMinutes: Math.floor(Math.random() * 16),
      rotatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1
    };

    writeJSON(profilePath, rotated);
    log.info(`Fingerprint rotated for channel ${channelId} (v${rotated.version})`);
    return rotated;
  }

  /**
   * Build Playwright browser launch options for a channel
   */
  static getPlaywrightOptions(channelId) {
    const profile = FingerprintRotator.getProfile(channelId);

    return {
      headless: true,
      userDataDir: profile.profileDir,
      args: [
        `--lang=${profile.locale}`,
        `--window-size=${profile.viewport.width},${profile.viewport.height}`,
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ],
      extraHTTPHeaders: {
        'Accept-Language': profile.acceptLanguage,
        'DNT': profile.dnt
      }
    };
  }

  /**
   * Get request headers for YouTube API calls from a specific channel
   * Ensures API requests look distinct per channel
   */
  static getApiHeaders(channelId) {
    const profile = FingerprintRotator.getProfile(channelId);

    return {
      'User-Agent': profile.userAgent,
      'Accept-Language': profile.acceptLanguage,
      'DNT': profile.dnt,
      'X-Client-Data': FingerprintRotator.generateClientData(channelId)
    };
  }

  /**
   * Generate a unique but consistent X-Client-Data header per channel
   */
  static generateClientData(channelId) {
    const seed = channelId + process.env.YOUTUBE_CLIENT_ID?.slice(0, 8) || 'ccos';
    return crypto.createHash('md5').update(seed).digest('base64').slice(0, 20);
  }

  /**
   * Add human-like jitter to upload timing
   */
  static applyUploadJitter(channelId, baseTime) {
    const profile = FingerprintRotator.getProfile(channelId);
    const jitterMs = profile.uploadTimeJitterMinutes * 60 * 1000;
    return new Date(new Date(baseTime).getTime() + jitterMs);
  }

  /**
   * Get all fingerprint profiles summary
   */
  static getAllProfiles() {
    const profiles = {};
    for (let i = 1; i <= 10; i++) {
      const channelId = String(i).padStart(2, '0');
      const profile = FingerprintRotator.getProfile(channelId);
      profiles[channelId] = {
        channelId,
        userAgent: profile.userAgent.slice(0, 40) + '...',
        locale: profile.locale,
        timezone: profile.timezone,
        version: profile.version,
        rotatedAt: profile.rotatedAt || profile.createdAt
      };
    }
    return profiles;
  }
}
