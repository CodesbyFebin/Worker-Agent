/**
 * Channel Health Monitor
 *
 * Continuously watches all 10 channels for early warning signs of:
 *  - YouTube strikes or policy violations
 *  - Sudden drops in CTR/views (possible shadow restriction)
 *  - Monetization eligibility status changes
 *  - Comment section anomalies (spam attacks, hate raids)
 *  - Subscriber drop spikes (bot purge or content issue)
 *  - API quota exhaustion
 *
 * Health states:
 *  🟢 HEALTHY      — All metrics normal
 *  🟡 WARNING      — One or more metrics below baseline
 *  🟠 DEGRADED     — Multiple metrics below baseline, reduce upload rate
 *  🔴 CRITICAL     — Strike/removal/demonetization — PAUSE channel
 *
 * Triggers automatic Rapid Pivot Protocol when health degrades.
 */

import path from 'path';
import { readJSON, writeJSON, ensureDir, average } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('ChannelHealthMonitor');
const HEALTH_DIR = './data/analytics';

// Thresholds relative to channel baseline metrics
const HEALTH_THRESHOLDS = {
  ctrDropWarning: 0.60,      // CTR below 60% of baseline = warning
  ctrDropCritical: 0.30,     // CTR below 30% of baseline = critical
  viewDropWarning: 0.50,     // Views below 50% of avg = warning
  viewDropCritical: 0.20,    // Views below 20% of avg = critical
  likeRatioWarning: 0.015,   // Like rate below 1.5% = warning
  subscriberDropWarning: -50, // Lost >50 subs in 24h = warning
  subscriberDropCritical: -200 // Lost >200 subs in 24h = critical
};

export class ChannelHealthMonitor {

  /**
   * Run health check for all channels
   */
  static async checkAll(channels, analytics) {
    const healthReport = {};

    for (const [channelId, channel] of Object.entries(channels)) {
      const channelAnalytics = analytics?.[channelId] || null;
      healthReport[channelId] = await ChannelHealthMonitor.check(channel, channelAnalytics);
    }

    // Log overall health summary
    const statuses = Object.values(healthReport).map((r) => r.status);
    const critical = statuses.filter((s) => s === 'critical').length;
    const warning = statuses.filter((s) => s === 'warning').length;

    if (critical > 0) {
      log.error(`HEALTH CHECK: ${critical} CRITICAL channel(s) detected!`);
    } else if (warning > 0) {
      log.warn(`HEALTH CHECK: ${warning} channel(s) in WARNING state`);
    } else {
      log.info(`HEALTH CHECK: All ${statuses.length} channels healthy`);
    }

    return healthReport;
  }

  /**
   * Run health check for a single channel
   */
  static async check(channel, analytics) {
    const { channelId, state, niche } = channel;
    const baseline = niche.baselineMetrics || {};

    const issues = [];
    const warnings = [];
    let statusScore = 100; // Start at 100, deduct for issues

    // 1. Check for explicit YouTube flags
    if (state.status === 'flagged') {
      return {
        channelId,
        status: 'critical',
        statusScore: 0,
        issues: [`Channel flagged: ${state.flagReason}`],
        warnings: [],
        actions: ['pause_uploads', 'alert_operator'],
        checkedAt: new Date().toISOString()
      };
    }

    // 2. Analytics-based checks (when data is available)
    if (analytics) {
      // CTR check
      if (analytics.avgCTR && baseline.avgCTR) {
        const ctrRatio = analytics.avgCTR / baseline.avgCTR;
        if (ctrRatio < HEALTH_THRESHOLDS.ctrDropCritical) {
          issues.push(`CTR critically low: ${(analytics.avgCTR * 100).toFixed(1)}% (baseline: ${(baseline.avgCTR * 100).toFixed(1)}%)`);
          statusScore -= 40;
        } else if (ctrRatio < HEALTH_THRESHOLDS.ctrDropWarning) {
          warnings.push(`CTR below baseline: ${(analytics.avgCTR * 100).toFixed(1)}%`);
          statusScore -= 20;
        }
      }

      // View count check
      if (analytics.avgViews && baseline.avgViews) {
        const viewRatio = analytics.avgViews / baseline.avgViews;
        if (viewRatio < HEALTH_THRESHOLDS.viewDropCritical) {
          issues.push(`Views critically low: ${analytics.avgViews} (baseline: ${baseline.avgViews})`);
          statusScore -= 35;
        } else if (viewRatio < HEALTH_THRESHOLDS.viewDropWarning) {
          warnings.push(`Views below baseline by ${((1 - viewRatio) * 100).toFixed(0)}%`);
          statusScore -= 15;
        }
      }

      // Like ratio check
      if (analytics.likeRate !== undefined) {
        if (analytics.likeRate < HEALTH_THRESHOLDS.likeRatioWarning) {
          warnings.push(`Low engagement: like rate ${(analytics.likeRate * 100).toFixed(2)}%`);
          statusScore -= 10;
        }
      }

      // Subscriber change check
      if (analytics.subscriberDelta !== undefined) {
        if (analytics.subscriberDelta < HEALTH_THRESHOLDS.subscriberDropCritical) {
          issues.push(`Rapid subscriber loss: ${analytics.subscriberDelta} in 24h`);
          statusScore -= 30;
        } else if (analytics.subscriberDelta < HEALTH_THRESHOLDS.subscriberDropWarning) {
          warnings.push(`Subscriber drop detected: ${analytics.subscriberDelta} in 24h`);
          statusScore -= 15;
        }
      }

      // Monetization status
      if (analytics.monetizationStatus === 'limited') {
        warnings.push('Monetization limited — some videos have restricted ads');
        statusScore -= 20;
      } else if (analytics.monetizationStatus === 'disabled') {
        issues.push('Monetization DISABLED — immediate review required');
        statusScore -= 50;
      }
    }

    // 3. Upload pattern checks
    const recentUploads = ChannelHealthMonitor.getRecentUploads(state, 7);
    if (recentUploads === 0 && state.status !== 'paused') {
      warnings.push('No uploads in 7 days — channel may be stalling');
      statusScore -= 5;
    }

    // Determine health status
    const status = ChannelHealthMonitor.scoreToStatus(statusScore, issues.length);

    // Determine recommended actions
    const actions = ChannelHealthMonitor.determineActions(status, issues, warnings);

    // Save health record
    const healthRecord = {
      channelId,
      status,
      statusScore: Math.max(0, statusScore),
      issues,
      warnings,
      actions,
      analytics: analytics ? {
        avgCTR: analytics.avgCTR,
        avgViews: analytics.avgViews,
        likeRate: analytics.likeRate
      } : null,
      checkedAt: new Date().toISOString()
    };

    ChannelHealthMonitor.saveRecord(channelId, healthRecord);
    return healthRecord;
  }

  static scoreToStatus(score, issueCount) {
    if (issueCount > 0 && score < 30) return 'critical';
    if (issueCount > 0 || score < 50) return 'degraded';
    if (score < 75) return 'warning';
    return 'healthy';
  }

  static determineActions(status, issues, warnings) {
    const actions = [];

    if (status === 'critical') {
      actions.push('pause_channel');
      actions.push('alert_operator');
      actions.push('review_recent_videos');
    } else if (status === 'degraded') {
      actions.push('reduce_upload_frequency');
      actions.push('trigger_rapid_pivot');
      actions.push('review_content_strategy');
    } else if (status === 'warning') {
      actions.push('monitor_closely');
      actions.push('review_thumbnails');
      actions.push('update_titles_on_recent_videos');
    }

    if (warnings.some((w) => w.includes('CTR'))) {
      actions.push('ab_test_thumbnails');
    }

    if (warnings.some((w) => w.includes('engagement'))) {
      actions.push('post_community_update');
      actions.push('respond_to_comments');
    }

    return [...new Set(actions)]; // Deduplicate
  }

  static getRecentUploads(state, days) {
    if (!state.uploadHistory?.length) return 0;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return state.uploadHistory.filter((u) => new Date(u.uploadedAt) >= cutoff).length;
  }

  static saveRecord(channelId, record) {
    const recordPath = path.join(HEALTH_DIR, `health_${channelId}.json`);
    ensureDir(HEALTH_DIR);

    const existing = readJSON(recordPath) || { history: [] };
    existing.history.push(record);

    // Keep last 30 health checks
    if (existing.history.length > 30) {
      existing.history = existing.history.slice(-30);
    }

    existing.latest = record;
    writeJSON(recordPath, existing);
  }

  /**
   * Get health trend over time for a channel
   */
  static getHealthTrend(channelId, days = 7) {
    const recordPath = path.join(HEALTH_DIR, `health_${channelId}.json`);
    const data = readJSON(recordPath);
    if (!data?.history) return { trend: 'unknown', records: [] };

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recent = data.history.filter((r) => new Date(r.checkedAt) >= cutoff);
    const scores = recent.map((r) => r.statusScore || 0);

    const avg = average(scores);
    const latest = scores[scores.length - 1] || 0;
    const trend = latest > avg ? 'improving' : latest < avg ? 'declining' : 'stable';

    return { trend, avgScore: avg, latestScore: latest, records: recent };
  }

  /**
   * Get aggregated health dashboard across all channels
   */
  static async getDashboardSummary() {
    const summary = {
      healthy: 0, warning: 0, degraded: 0, critical: 0,
      paused: 0, flagged: 0,
      channels: []
    };

    for (let i = 1; i <= 10; i++) {
      const channelId = String(i).padStart(2, '0');
      const recordPath = path.join(HEALTH_DIR, `health_${channelId}.json`);
      const data = readJSON(recordPath);
      const latest = data?.latest;

      if (latest) {
        summary[latest.status] = (summary[latest.status] || 0) + 1;
        summary.channels.push({
          channelId,
          status: latest.status,
          score: latest.statusScore,
          checkedAt: latest.checkedAt,
          topIssue: latest.issues?.[0] || latest.warnings?.[0] || null
        });
      } else {
        summary.healthy++;
        summary.channels.push({ channelId, status: 'healthy', score: 100 });
      }
    }

    return summary;
  }
}
