/**
 * Social Crosspost Executor
 * Phase 13 — The "social.crosspost" workflow node
 *
 * Takes the output of video.assemble (final MP4 path) and fans out to:
 *  - instagram-queue (immediate)
 *  - facebook-queue  (15-minute stagger enforced in FB worker)
 *
 * Workflow node config:
 *  {
 *    type: "social.crosspost",
 *    targetPlatforms: ["instagram", "facebook"],   // default: both
 *    skipStagger: false,                            // set true to skip FB delay
 *    notifyOnComplete: true                         // sends Telegram/Discord alert
 *  }
 *
 * Returns:
 *  {
 *    youtube: { videoId, url },
 *    instagram: { mediaId } | null,
 *    facebook: { videoId } | null,
 *    publishedAt: ISO string
 *  }
 */

import { InstagramWorker } from '../workers/instagram.worker.js';
import { FacebookWorker } from '../workers/facebook.worker.js';
import { TokenResolver } from '../services/token-resolver.js';
import { NotificationService } from '../services/notification.service.js';
import { writeJSON, ensureDir } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('CrosspostExecutor');

export class CrosspostExecutor {

  /**
   * Execute a full crosspost job for a content package
   */
  static async execute(contentPackage, channelConfig, nodeConfig = {}) {
    const {
      targetPlatforms = ['instagram', 'facebook'],
      skipStagger = false,
      notifyOnComplete = true
    } = nodeConfig;

    const channelId = channelConfig.channelId;
    const availablePlatforms = TokenResolver.getAvailablePlatforms(channelId);

    const activePlatforms = targetPlatforms.filter((p) => availablePlatforms.includes(p));

    if (activePlatforms.length === 0) {
      log.channel(channelId).warn('No social platforms configured — crosspost skipped');
      return { skipped: true, reason: 'no_credentials' };
    }

    log.channel(channelId).info(`Crossposting to: ${activePlatforms.join(', ')}`);

    const jobData = {
      videoPath: CrosspostExecutor.resolveVideoPath(contentPackage),
      title: contentPackage.metadata?.primaryTitle || contentPackage.script?.keyword,
      niche: channelConfig.niche,
      channelId,
      keyword: contentPackage.script?.keyword,
      organizationId: channelConfig.organizationId || 'default'
    };

    const results = {
      channelId,
      platforms: {},
      publishedAt: new Date().toISOString()
    };

    // Execute platform uploads — IG first (immediate), FB with stagger
    const platformJobs = [];

    if (activePlatforms.includes('instagram')) {
      platformJobs.push(
        CrosspostExecutor.runWithErrorCapture('instagram', () =>
          InstagramWorker.upload({ ...jobData })
        )
      );
    }

    if (activePlatforms.includes('facebook')) {
      platformJobs.push(
        CrosspostExecutor.runWithErrorCapture('facebook', () =>
          FacebookWorker.upload({ ...jobData, skipStagger })
        )
      );
    }

    // Run in parallel (FB worker handles its own internal stagger)
    const settled = await Promise.allSettled(platformJobs);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        const { platform, data } = result.value;
        results.platforms[platform] = { success: true, ...data };
        log.channel(channelId).info(`${platform}: ✅ Published`);
      } else {
        log.channel(channelId).error(`Platform upload failed: ${result.reason?.message}`);
        const errParts = result.reason?.message?.match(/^(\w+):/);
        const platform = errParts?.[1]?.toLowerCase() || 'unknown';
        results.platforms[platform] = { success: false, error: result.reason?.message };
      }
    }

    // Save crosspost record
    CrosspostExecutor.saveRecord(channelId, results, contentPackage);

    // Send notification
    if (notifyOnComplete) {
      const successPlatforms = Object.entries(results.platforms)
        .filter(([, v]) => v.success)
        .map(([k]) => k.toUpperCase());

      await NotificationService.send({
        type: 'crosspost_complete',
        channelId,
        message: `✅ "${jobData.title}" posted to: YT${successPlatforms.length ? ' + ' + successPlatforms.join(' + ') : ''}`,
        data: results
      });
    }

    return results;
  }

  /**
   * Run a platform job and capture errors with platform label
   */
  static async runWithErrorCapture(platform, fn) {
    try {
      const data = await fn();
      return { platform, data };
    } catch (err) {
      throw new Error(`${platform}: ${err.message}`);
    }
  }

  /**
   * Resolve the short video path from the content package
   * Prefers the Short (9:16) version over the Pillar
   */
  static resolveVideoPath(contentPackage) {
    // Prefer the pre-rendered Short version
    const shortId = contentPackage.contentVersions?.short?.id;
    if (shortId) {
      const shortPath = `./output/videos/${shortId}_short.mp4`;
      const { existsSync } = require('fs');
      if (existsSync(shortPath)) return shortPath;
    }

    // Fall back to pillar video
    const pillarId = contentPackage.script?.id;
    if (pillarId) return `./output/videos/${pillarId}_pillar.mp4`;

    // Last resort — any video path in the package
    return contentPackage.videoPath || './output/videos/placeholder.mp4';
  }

  static saveRecord(channelId, results, contentPackage) {
    ensureDir('./data/social');
    const filePath = `./data/social/crosspost_${channelId}.json`;
    let existing = [];
    try {
      const raw = require('fs').readFileSync(filePath, 'utf-8');
      existing = JSON.parse(raw).records || [];
    } catch {}
    existing.push({
      ...results,
      keyword: contentPackage.script?.keyword,
      title: contentPackage.metadata?.primaryTitle
    });
    require('fs').writeFileSync(filePath, JSON.stringify({ records: existing.slice(-100) }, null, 2));
  }

  /**
   * Get crosspost history for a channel
   */
  static getHistory(channelId, days = 7) {
    const filePath = `./data/social/crosspost_${channelId}.json`;
    try {
      const data = JSON.parse(require('fs').readFileSync(filePath, 'utf-8'));
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return (data.records || []).filter((r) => new Date(r.publishedAt) >= cutoff);
    } catch {
      return [];
    }
  }
}
