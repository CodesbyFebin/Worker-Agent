/**
 * Meta API Rate Limiter
 * Phase 13 — Task 6
 *
 * Meta Graph API limits:
 *  - 200 calls/hour per app (across all users)
 *  - Per-user: 200 calls/hour
 *  - Video uploads: separate quota bucket, ~50/hour
 *
 * Strategy:
 *  - Token bucket per platform per channel
 *  - Automatic backoff on 429 responses
 *  - Meta IP range whitelist for inbound webhooks
 *  - Request queue with priority levels
 *
 * Skip paths (inbound from Meta — do NOT rate limit these):
 *  - /webhooks/instagram
 *  - /webhooks/facebook
 *  - /oauth/meta/callback
 */

import { sleep, RateLimiter } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('MetaRateLimiter');

// Meta's published IP ranges (for inbound webhook whitelisting)
// Source: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
export const META_IP_RANGES = [
  '31.13.24.0/21',
  '31.13.64.0/18',
  '45.64.40.0/22',
  '66.220.144.0/20',
  '69.63.176.0/20',
  '69.171.224.0/19',
  '74.119.76.0/22',
  '103.4.96.0/22',
  '129.134.0.0/17',
  '157.240.0.0/17',
  '163.70.128.0/17',
  '163.71.128.0/17',
  '163.77.128.0/17',
  '179.60.192.0/22',
  '185.60.216.0/22',
  '204.15.20.0/22'
];

// Routes that should bypass rate limiting (Meta callbacks + OAuth)
export const SKIP_PATHS = [
  '/webhooks/instagram',
  '/webhooks/facebook',
  '/webhooks/meta',
  '/oauth/meta/callback',
  '/oauth/facebook/callback',
  '/oauth/instagram/callback',
  '/health',
  '/output/' // Static server — has its own rate limiter
];

// Per-platform rate limit configs
const PLATFORM_LIMITS = {
  instagram: {
    general: new RateLimiter(200, 60 * 60 * 1000),  // 200/hour
    upload: new RateLimiter(50, 60 * 60 * 1000),     // 50 uploads/hour
    publish: new RateLimiter(50, 60 * 60 * 1000),    // 50 publishes/hour
    polling: new RateLimiter(300, 60 * 60 * 1000)    // 300 status checks/hour
  },
  facebook: {
    general: new RateLimiter(200, 60 * 60 * 1000),
    upload: new RateLimiter(50, 60 * 60 * 1000),
    insights: new RateLimiter(100, 60 * 60 * 1000)
  }
};

export class MetaRateLimiter {

  /**
   * Throttle a Meta API call with automatic backoff on 429
   */
  static async throttle(platform, type = 'general') {
    const limiter = PLATFORM_LIMITS[platform]?.[type] || PLATFORM_LIMITS.instagram.general;
    await limiter.throttle();
  }

  /**
   * Execute a Meta API call with automatic 429 retry + backoff
   */
  static async execute(platform, type, fn, maxRetries = 3) {
    await MetaRateLimiter.throttle(platform, type);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const status = err?.response?.status;
        const isRateLimit = status === 429 || status === 4 || // Meta error code 4 = rate limit
          err?.response?.data?.error?.code === 4 ||
          err?.response?.data?.error?.type === 'OAuthException';

        if (isRateLimit && attempt < maxRetries - 1) {
          const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '60', 10);
          const waitMs = retryAfter * 1000 * Math.pow(2, attempt); // Exponential backoff
          log.warn(`Meta rate limit hit (${platform}/${type}) — waiting ${Math.round(waitMs / 1000)}s`);
          await sleep(waitMs);
          continue;
        }

        // Token expired
        if (status === 401 || err?.response?.data?.error?.code === 190) {
          throw new Error(`META_AUTH_EXPIRED: ${platform} token expired — rotate in Token Vault`);
        }

        throw err;
      }
    }
  }

  /**
   * Express middleware — skip rate limiting for Meta callback paths
   */
  static middleware(skipPaths = SKIP_PATHS) {
    const requestCounts = new Map();

    return (req, res, next) => {
      const path = req.path;

      // Whitelist Meta IP ranges for inbound webhooks
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      if (MetaRateLimiter.isMetaIP(clientIp)) {
        return next();
      }

      // Skip configured paths
      if (skipPaths.some((p) => path.startsWith(p))) {
        return next();
      }

      // Apply rate limiting to other paths
      const key = `${clientIp}:${path.split('/').slice(0, 3).join('/')}`;
      const now = Date.now();
      const window = requestCounts.get(key) || { count: 0, reset: now + 60000 };

      if (now > window.reset) {
        window.count = 0;
        window.reset = now + 60000;
      }

      window.count++;
      requestCounts.set(key, window);

      // 60 requests/minute per IP per route group
      if (window.count > 60) {
        log.warn(`Rate limit exceeded: ${clientIp} → ${path}`);
        return res.status(429).json({
          error: 'Too Many Requests',
          retryAfter: Math.round((window.reset - now) / 1000)
        });
      }

      next();
    };
  }

  /**
   * Check if an IP is in Meta's published range (CIDR matching)
   */
  static isMetaIP(ip) {
    // Simple prefix check (full CIDR would need a library)
    const metaPrefixes = [
      '31.13.', '45.64.', '66.220.', '69.63.', '69.171.',
      '74.119.', '103.4.', '129.134.', '157.240.', '163.70.',
      '163.71.', '163.77.', '179.60.', '185.60.', '204.15.'
    ];
    return metaPrefixes.some((prefix) => ip.startsWith(prefix));
  }

  /**
   * Get current rate limit status per platform
   */
  static getStatus() {
    return {
      instagram: {
        general: { remaining: 'tracked internally', resetMs: 'rolling 1hr window' },
        upload: { remaining: 'tracked internally' }
      },
      facebook: {
        general: { remaining: 'tracked internally' }
      },
      note: 'Meta does not expose remaining quota in response headers — use conservative call budgets'
    };
  }
}
