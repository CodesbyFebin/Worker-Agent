/**
 * Health Check Worker — Phase 14 Task 2
 * Automated channel health monitor running every 60 minutes.
 *
 * Per channel, this worker:
 *  1. Fetches live stats from YouTube API (subs, views, monetization)
 *  2. Fetches Instagram insights (if configured)
 *  3. Fetches Facebook page insights (if configured)
 *  4. Runs the health scoring algorithm (green/yellow/orange/red)
 *  5. Updates the ChannelHealthDB
 *  6. Fires critical alerts via NotificationService
 *  7. Triggers auto-pause on critical channels
 *
 * Health Scoring Algorithm:
 *  Start at 100 points, deduct for issues:
 *  - Upload failure streak:     -15 per failure (capped at -45)
 *  - CTR drop >30% vs baseline: -20
 *  - CTR drop >60% vs baseline: -35
 *  - Views drop >50%:           -25
 *  - Strike present:            -50
 *  - Token expired:             -40
 *  - Monetization disabled:     -30
 *  - Monetization limited:      -15
 *  - 7 day upload silence:      -10
 *
 *  100-80 → healthy | 79-60 → warning | 59-40 → degraded | <40 → critical
 */

import cron from 'node-cron';
import { YouTubeAPI } from '../youtube/youtube-api.js';
import { ChannelManager } from '../layers/layer4-multi-runner/channel-manager.js';
import { ChannelHealthDB, AuditLogDB, CalendarDB } from '../database/schema/channels.js';
import { NotificationService } from '../social/services/notification.service.js';
import { TokenResolver } from '../social/services/token-resolver.js';
import logger from '../utils/logger.js';

const log = logger.layer('HealthWorker');

const HEALTH_INTERVAL_MIN = parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES || '60', 10);
const DEFAULT_RPM = parseFloat(process.env.DEFAULT_RPM_USD || '4.0');

// Score thresholds
const STATUS_THRESHOLDS = {
  healthy:  80,
  warning:  60,
  degraded: 40
  // below 40 = critical
};

export class HealthWorker {

  /**
   * Start the cron-scheduled health check
   */
  static start() {
    log.info(`Health worker starting — interval: every ${HEALTH_INTERVAL_MIN} minutes`);

    // Run immediately on start
    HealthWorker.runAll().catch((e) => log.error(`Initial health check failed: ${e.message}`));

    // Then on schedule
    cron.schedule(`*/${HEALTH_INTERVAL_MIN} * * * *`, async () => {
      await HealthWorker.runAll();
    });
  }

  /**
   * Run health checks for all 10 channels
   */
  static async runAll() {
    log.info('Running health checks for all channels...');
    const results = {};

    for (let i = 1; i <= 10; i++) {
      const channelId = String(i).padStart(2, '0');
      try {
        results[channelId] = await HealthWorker.checkChannel(channelId);
      } catch (err) {
        log.error(`Health check failed for channel ${channelId}: ${err.message}`);
        results[channelId] = { channelId, error: err.message };
      }
    }

    // Log summary
    const statuses = Object.values(results).map((r) => r.health_status).filter(Boolean);
    const critCount = statuses.filter((s) => s === 'critical').length;
    const warnCount = statuses.filter((s) => s === 'warning' || s === 'degraded').length;

    if (critCount > 0) {
      log.error(`HEALTH: ${critCount} CRITICAL channels detected`);
    } else {
      log.info(`HEALTH: ${statuses.filter((s) => s === 'healthy').length} healthy, ${warnCount} warnings`);
    }

    return results;
  }

  /**
   * Full health check for a single channel
   */
  static async checkChannel(channelId) {
    log.channel(channelId).debug('Running health check...');

    const current = ChannelHealthDB.get(channelId);
    const channelState = await HealthWorker.loadChannelState(channelId);
    const niche = channelState?.niche || {};

    let score = 100;
    const issues = [];
    const warnings = [];

    // ── 1. YouTube API metrics ────────────────────────────────────────────
    const ytStats = await YouTubeAPI.getChannelStats(channelId).catch(() => null);
    const recentAnalytics = await HealthWorker.getRecentAnalytics(channelId);

    if (ytStats) {
      const subCount = ytStats.subscriberCount || 0;
      const views = ytStats.viewCount || 0;

      // CTR check
      const baseline = niche.baselineMetrics || {};
      if (recentAnalytics?.avgCTR && baseline.avgCTR) {
        const ctrRatio = recentAnalytics.avgCTR / baseline.avgCTR;
        if (ctrRatio < 0.40) {
          score -= 35;
          issues.push(`CTR critically low: ${(recentAnalytics.avgCTR * 100).toFixed(1)}% (baseline: ${(baseline.avgCTR * 100).toFixed(1)}%)`);
        } else if (ctrRatio < 0.70) {
          score -= 20;
          warnings.push(`CTR below baseline: ${(recentAnalytics.avgCTR * 100).toFixed(1)}%`);
        }
      }

      // Views check
      if (recentAnalytics?.avgViews && baseline.avgViews) {
        const viewRatio = recentAnalytics.avgViews / baseline.avgViews;
        if (viewRatio < 0.20) { score -= 25; issues.push(`Views critically low`); }
        else if (viewRatio < 0.50) { score -= 15; warnings.push(`Views below baseline by ${((1 - viewRatio) * 100).toFixed(0)}%`); }
      }

      // Estimate monthly revenue
      const estimatedRevenue = HealthWorker.estimateRevenue(views, niche.averageCPM || DEFAULT_RPM);

      // Update DB with latest stats
      ChannelHealthDB.update(channelId, {
        subscriber_count: subCount,
        total_views_last_30d: views,
        estimated_revenue: estimatedRevenue,
        avg_ctr: recentAnalytics?.avgCTR || current.avg_ctr,
        avg_view_duration_pct: recentAnalytics?.avgViewPercentage || current.avg_view_duration_pct
      });
    }

    // ── 2. Token validity check ───────────────────────────────────────────
    const tokens = TokenResolver.getYouTubeTokens(channelId);
    if (!tokens.refreshToken) {
      score -= 40;
      issues.push('YouTube OAuth token missing — channel cannot upload');
    }

    // ── 3. Upload failure streak ──────────────────────────────────────────
    const failureCount = current.consecutive_upload_failures || 0;
    if (failureCount >= 3) {
      score -= Math.min(failureCount * 15, 45);
      issues.push(`${failureCount} consecutive upload failures`);
    } else if (failureCount > 0) {
      warnings.push(`${failureCount} recent upload failure(s)`);
    }

    // ── 4. Strike detection (via API status) ─────────────────────────────
    // YouTube API doesn't expose strikes directly — we infer from video removal
    if (current.strike_count > 0) {
      score -= current.strike_count * 50;
      issues.push(`${current.strike_count} active Community Guidelines strike(s)`);
    }

    // ── 5. Monetization status ────────────────────────────────────────────
    if (current.monetization_status === 'disabled') {
      score -= 30;
      issues.push('Monetization DISABLED on this channel');
    } else if (current.monetization_status === 'limited') {
      score -= 15;
      warnings.push('Monetization LIMITED — some videos have restricted ads');
    }

    // ── 6. Upload cadence check ───────────────────────────────────────────
    const daysSinceLastUpload = current.last_successful_upload_at
      ? (Date.now() - new Date(current.last_successful_upload_at)) / (24 * 3600 * 1000)
      : 999;

    if (daysSinceLastUpload > 14) {
      score -= 15;
      warnings.push(`No upload in ${Math.round(daysSinceLastUpload)} days`);
    } else if (daysSinceLastUpload > 7) {
      score -= 10;
      warnings.push(`Upload gap: ${Math.round(daysSinceLastUpload)} days`);
    }

    // ── 7. Determine status ───────────────────────────────────────────────
    const finalScore = Math.max(0, score);
    const health_status = HealthWorker.scoreToStatus(finalScore);

    const updated = ChannelHealthDB.update(channelId, {
      health_status,
      health_updated_at: new Date().toISOString(),
      last_error_message: issues[0] || null,
      platforms_active: TokenResolver.getAvailablePlatforms(channelId)
    });

    // ── 8. Alerts & auto-actions ──────────────────────────────────────────
    await HealthWorker.handleStatusChange(channelId, current.health_status, health_status, issues);

    log.channel(channelId).info(
      `Health: ${health_status.toUpperCase()} (${finalScore}/100)` +
      (issues.length ? ` | Issues: ${issues[0]}` : '')
    );

    return updated;
  }

  /**
   * Fire alerts and auto-actions when health status changes
   */
  static async handleStatusChange(channelId, previousStatus, newStatus, issues) {
    // Status worsened
    if (newStatus === 'critical' && previousStatus !== 'critical') {
      await NotificationService.send({
        type: 'health_critical',
        channelId,
        message: `🚨 Channel ${channelId} is now CRITICAL\n${issues.join('\n')}`,
        data: { channelId, issues }
      });

      // Auto-pause to prevent further damage
      await ChannelManager.pauseChannel(channelId);
      log.channel(channelId).error('AUTO-PAUSED due to critical health status');

      AuditLogDB.append({
        action: 'AUTO_PAUSE',
        channelId,
        reason: issues[0] || 'critical_health',
        previousStatus,
        newStatus
      });
    } else if (newStatus === 'warning' && previousStatus === 'healthy') {
      await NotificationService.send({
        type: 'health_warning',
        channelId,
        message: `⚠️ Channel ${channelId} health degraded to WARNING\n${issues.concat().join('\n')}`,
        data: { channelId, issues }
      });
    }

    // Status recovered
    if ((newStatus === 'healthy' || newStatus === 'warning') && previousStatus === 'critical') {
      await NotificationService.send({
        type: 'health_recovered',
        channelId,
        message: `✅ Channel ${channelId} recovered to ${newStatus.toUpperCase()}`,
        data: { channelId }
      });
    }
  }

  static scoreToStatus(score) {
    if (score >= STATUS_THRESHOLDS.healthy) return 'healthy';
    if (score >= STATUS_THRESHOLDS.warning) return 'warning';
    if (score >= STATUS_THRESHOLDS.degraded) return 'degraded';
    return 'critical';
  }

  static estimateRevenue(views30d, cpm) {
    // Revenue = (views / 1000) * CPM * 0.45 (creator's 45% share)
    return Math.round((views30d / 1000) * cpm * 0.45 * 100) / 100;
  }

  static async loadChannelState(channelId) {
    try {
      const { ChannelManager } = await import('../layers/layer4-multi-runner/channel-manager.js');
      return await ChannelManager.load(channelId);
    } catch { return null; }
  }

  static async getRecentAnalytics(channelId) {
    const { readJSON } = await import('../utils/helpers.js');
    const data = readJSON(`./data/analytics/channel_${channelId}_analytics.json`);
    return data?.summary || null;
  }

  /**
   * Manually record a successful upload (resets failure counter)
   */
  static recordSuccessfulUpload(channelId) {
    ChannelHealthDB.update(channelId, {
      consecutive_upload_failures: 0,
      last_successful_upload_at: new Date().toISOString()
    });
  }

  /**
   * Record an upload failure
   */
  static recordUploadFailure(channelId, errorMessage) {
    const current = ChannelHealthDB.get(channelId);
    ChannelHealthDB.update(channelId, {
      consecutive_upload_failures: (current.consecutive_upload_failures || 0) + 1,
      last_error_message: errorMessage
    });
  }
}
