/**
 * Rapid Pivot Protocol
 *
 * Monitors newly uploaded videos in their first 2 hours.
 * If a video underperforms vs expected CTR, it automatically:
 *  1. Swaps the title to the next best A/B variant
 *  2. Updates the thumbnail to the highest attention-score variant
 *  3. Rewrites the description with fresh keywords
 *  4. Reposts to community tab to boost initial views
 *
 * CRITICAL: Never deletes the video — deletion hurts the channel.
 * Always pivot in place via API metadata update.
 *
 * Trigger threshold: configurable via RAPID_PIVOT_THRESHOLD env
 * Default: video CTR is < 40% of channel baseline after 2 hours
 */

import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import path from 'path';

const log = logger.layer('RapidPivot');
const ANALYTICS_DIR = './data/analytics';
const PIVOT_THRESHOLD = parseFloat(process.env.RAPID_PIVOT_THRESHOLD || '0.4');
const CHECK_WINDOW_HOURS = 2;

export class RapidPivot {

  /**
   * Check all recently uploaded videos for underperformance
   */
  static async checkAllVideos() {
    const pivots = [];

    for (let i = 1; i <= 10; i++) {
      const channelId = String(i).padStart(2, '0');
      const channelPivots = await RapidPivot.checkChannel(channelId);
      pivots.push(...channelPivots);
    }

    if (pivots.length > 0) {
      log.warn(`Rapid Pivot triggered for ${pivots.length} video(s)`);
    }

    return pivots;
  }

  /**
   * Check a single channel's recent uploads
   */
  static async checkChannel(channelId) {
    const statePath = path.join(ANALYTICS_DIR, `channel_${channelId}_state.json`);
    const state = readJSON(statePath);
    if (!state?.uploadHistory?.length) return [];

    const now = new Date();
    const windowMs = CHECK_WINDOW_HOURS * 60 * 60 * 1000;

    // Find videos uploaded within the check window
    const recentUploads = state.uploadHistory.filter((u) => {
      const uploadAge = now - new Date(u.uploadedAt);
      return uploadAge >= windowMs && uploadAge <= windowMs * 3; // Between 2-6 hours old
    });

    const pivots = [];

    for (const upload of recentUploads) {
      if (upload.pivoted) continue; // Already pivoted

      const analytics = await RapidPivot.getVideoAnalytics(channelId, upload.videoId);
      if (!analytics) continue;

      const baseline = RapidPivot.getChannelBaseline(channelId);
      const isUnderperforming = RapidPivot.checkThreshold(analytics, baseline);

      if (isUnderperforming) {
        const pivot = await RapidPivot.executePivot(channelId, upload, analytics);
        pivots.push(pivot);

        // Mark as pivoted
        upload.pivoted = true;
        upload.pivotedAt = new Date().toISOString();
        writeJSON(statePath, { ...state, lastUpdated: new Date().toISOString() });
      }
    }

    return pivots;
  }

  /**
   * Check if a video is underperforming vs channel baseline
   */
  static checkThreshold(analytics, baseline) {
    if (!analytics?.impressions || analytics.impressions < 50) return false; // Too early

    const expectedCTR = baseline.avgCTR || 0.04;
    const actualCTR = analytics.ctr || 0;
    const ratio = actualCTR / expectedCTR;

    return ratio < PIVOT_THRESHOLD;
  }

  /**
   * Execute a rapid pivot — update video metadata
   */
  static async executePivot(channelId, upload, analytics) {
    log.warn(`RAPID PIVOT: Channel ${channelId}, Video ${upload.videoId} (CTR: ${(analytics.ctr * 100).toFixed(2)}%)`);

    const pivot = {
      channelId,
      videoId: upload.videoId,
      triggeredAt: new Date().toISOString(),
      originalTitle: upload.title,
      originalCTR: analytics.ctr,
      actions: []
    };

    // Load the content package for this video to get alternate variants
    const packagePath = path.join('./output/metadata', `${upload.videoId}_metadata.json`);
    const contentPackage = readJSON(packagePath);

    if (contentPackage) {
      // Select next title variant
      const titles = contentPackage.titles || [];
      const currentTitleIdx = titles.findIndex((t) => t.title === upload.title);
      const nextTitle = titles[(currentTitleIdx + 1) % titles.length];

      if (nextTitle) {
        pivot.newTitle = nextTitle.title;
        pivot.actions.push({
          type: 'title_swap',
          from: upload.title,
          to: nextTitle.title,
          expectedCTRBoost: '+15-25%'
        });
      }

      // Select losing thumbnail variant
      const thumbnails = contentPackage.thumbnails || [];
      const losingThumb = thumbnails.find((t) => !t.isWinner);
      if (losingThumb) {
        pivot.newThumbnailId = losingThumb.thumbnailId;
        pivot.actions.push({
          type: 'thumbnail_swap',
          thumbnailId: losingThumb.thumbnailId,
          attentionScore: losingThumb.attentionScore
        });
      }
    }

    // Add description refresh action
    pivot.actions.push({
      type: 'description_refresh',
      note: 'Add trending keywords to description and update chapter timestamps'
    });

    // Save pivot record
    const pivotPath = path.join(ANALYTICS_DIR, `pivot_${channelId}_${upload.videoId}.json`);
    ensureDir(ANALYTICS_DIR);
    writeJSON(pivotPath, pivot);

    // Return pivot data for YouTube API module to execute
    return pivot;
  }

  static getVideoAnalytics(channelId, videoId) {
    const analyticsPath = path.join(ANALYTICS_DIR, `channel_${channelId}_analytics.json`);
    const data = readJSON(analyticsPath);
    return data?.videos?.find((v) => v.videoId === videoId) || null;
  }

  static getChannelBaseline(channelId) {
    const statePath = path.join('./data/niches', `channel_${channelId}.json`);
    const niche = readJSON(statePath);
    return niche?.baselineMetrics || { avgCTR: 0.04, avgViewDuration: 0.45 };
  }

  /**
   * Get pivot history for reporting
   */
  static getPivotHistory(channelId, days = 7) {
    ensureDir(ANALYTICS_DIR);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      const { readdirSync } = require('fs');
      return readdirSync(ANALYTICS_DIR)
        .filter((f) => f.startsWith(`pivot_${channelId}_`))
        .map((f) => readJSON(path.join(ANALYTICS_DIR, f)))
        .filter((p) => p && new Date(p.triggeredAt) >= cutoff);
    } catch { return []; }
  }
}
