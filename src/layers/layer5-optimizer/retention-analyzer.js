/**
 * Retention Analyzer
 *
 * Fetches audience retention curves from YouTube Analytics API and
 * maps performance back to specific script sections.
 *
 * Key insight: AVD (Average View Duration) % is the single strongest
 * signal for the 2026 YouTube algorithm. A 90% retention on a 5-min
 * video beats 30% on a 20-min video every time.
 *
 * What this module produces:
 *  - Per-segment retention scores (which script sections lose viewers)
 *  - Drop-off point identification (timestamp where most viewers leave)
 *  - Re-watch segment identification (seek & re-seek signals)
 *  - Actionable section-level recommendations for next generation
 */

import path from 'path';
import { readJSON, writeJSON, ensureDir, average, movingAverage } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('RetentionAnalyzer');
const ANALYTICS_DIR = './data/analytics';

export class RetentionAnalyzer {

  /**
   * Analyze retention data for all channels' recent videos
   */
  static async analyzeAll() {
    const insights = [];
    for (let i = 1; i <= 10; i++) {
      const channelId = String(i).padStart(2, '0');
      const channelInsights = await RetentionAnalyzer.analyzeChannel(channelId);
      insights.push(...channelInsights);
    }
    log.info(`Retention analysis complete: ${insights.length} video insights`);
    return insights;
  }

  /**
   * Analyze retention for a specific channel's recent videos
   */
  static async analyzeChannel(channelId) {
    const analyticsPath = path.join(ANALYTICS_DIR, `channel_${channelId}_analytics.json`);
    const analyticsData = readJSON(analyticsPath);
    if (!analyticsData?.videos) return [];

    const insights = [];
    for (const video of analyticsData.videos.slice(-20)) {
      if (!video.retentionCurve) continue;
      const insight = RetentionAnalyzer.analyzeRetentionCurve(video, channelId);
      insights.push(insight);
    }
    return insights;
  }

  /**
   * Analyze a single video's retention curve
   */
  static analyzeRetentionCurve(video, channelId) {
    const curve = video.retentionCurve || [];
    if (curve.length === 0) {
      return { videoId: video.videoId, channelId, avd: 0, insights: [], recommendations: [] };
    }

    // Smooth the curve with moving average
    const smoothed = movingAverage(curve, 3);

    // Find drop-off points (where retention drops > 5% in one interval)
    const dropOffPoints = [];
    for (let i = 1; i < smoothed.length; i++) {
      const drop = smoothed[i - 1] - smoothed[i];
      if (drop > 0.05) {
        dropOffPoints.push({
          position: i / smoothed.length,
          percentThrough: Math.round((i / smoothed.length) * 100),
          retentionBefore: smoothed[i - 1],
          retentionAfter: smoothed[i],
          dropAmount: drop
        });
      }
    }

    // Find re-watch segments (where retention spikes back up)
    const reWatchSegments = [];
    for (let i = 2; i < smoothed.length; i++) {
      const rise = smoothed[i] - smoothed[i - 1];
      if (rise > 0.02) {
        reWatchSegments.push({
          position: i / smoothed.length,
          percentThrough: Math.round((i / smoothed.length) * 100),
          riseAmount: rise
        });
      }
    }

    // Calculate AVD as area under retention curve
    const avd = average(curve);

    // Identify the "power zone" — highest sustained retention segment
    const powerZoneStart = RetentionAnalyzer.findPowerZone(smoothed);

    // Generate section-level recommendations
    const recommendations = RetentionAnalyzer.generateRecommendations(
      dropOffPoints, reWatchSegments, avd, video
    );

    const insight = {
      videoId: video.videoId,
      channelId,
      avd,
      avdPercent: Math.round(avd * 100),
      durationSeconds: video.durationSeconds,
      dropOffPoints: dropOffPoints.slice(0, 3), // Top 3 worst drop-offs
      reWatchSegments: reWatchSegments.slice(0, 3),
      powerZonePercent: powerZoneStart,
      recommendations,
      rawCurveLength: curve.length,
      analyzedAt: new Date().toISOString()
    };

    // Save insight
    const insightPath = path.join(ANALYTICS_DIR, `retention_${channelId}_${video.videoId}.json`);
    ensureDir(ANALYTICS_DIR);
    writeJSON(insightPath, insight);

    return insight;
  }

  /**
   * Find the percentage through the video where retention is strongest (sustained)
   */
  static findPowerZone(smoothedCurve) {
    let bestAvg = 0;
    let bestStart = 0;
    const windowSize = Math.floor(smoothedCurve.length * 0.15); // 15% window

    for (let i = 0; i < smoothedCurve.length - windowSize; i++) {
      const windowAvg = average(smoothedCurve.slice(i, i + windowSize));
      if (windowAvg > bestAvg) {
        bestAvg = windowAvg;
        bestStart = i;
      }
    }

    return Math.round((bestStart / smoothedCurve.length) * 100);
  }

  /**
   * Generate actionable script recommendations from retention data
   */
  static generateRecommendations(dropOffPoints, reWatchSegments, avd, video) {
    const recs = [];

    // High early drop-off (first 30%) — hook problem
    const earlyDrops = dropOffPoints.filter((d) => d.percentThrough < 30);
    if (earlyDrops.length > 0) {
      const worst = earlyDrops.sort((a, b) => b.dropAmount - a.dropAmount)[0];
      recs.push({
        type: 'hook_improvement',
        priority: 'high',
        finding: `${worst.dropAmount.toFixed(0) * 100}% viewer drop at ${worst.percentThrough}% — hook needs stronger pattern interrupt`,
        action: 'Shorten intro, move most valuable insight earlier, use stronger pattern interrupt in first 30 seconds'
      });
    }

    // Mid-video drop-off (30-70%) — content density issue
    const midDrops = dropOffPoints.filter((d) => d.percentThrough >= 30 && d.percentThrough < 70);
    if (midDrops.length > 1) {
      recs.push({
        type: 'pacing_improvement',
        priority: 'medium',
        finding: `${midDrops.length} mid-video drop points detected — content may be too dense or slow`,
        action: 'Increase retention hook frequency, add visual variety, break long explanations with examples'
      });
    }

    // Low overall AVD
    if (avd < 0.35) {
      recs.push({
        type: 'overall_retention',
        priority: 'high',
        finding: `AVD only ${Math.round(avd * 100)}% — below the 40% algorithm threshold`,
        action: 'Reduce video length, front-load value, increase hook cadence to every 5 seconds in first 2 minutes'
      });
    } else if (avd > 0.65) {
      recs.push({
        type: 'excellent_retention',
        priority: 'low',
        finding: `Excellent AVD: ${Math.round(avd * 100)}% — replicate this content structure`,
        action: 'Use this video\'s section structure and pacing as the new template baseline'
      });
    }

    // Re-watch segments — valuable content identified
    if (reWatchSegments.length > 0) {
      recs.push({
        type: 'easter_egg_opportunity',
        priority: 'low',
        finding: `Re-watch activity at ${reWatchSegments[0].percentThrough}% — viewers returning to this segment`,
        action: 'Add explicit Easter egg cue near this timestamp in future videos to encourage intentional re-watches'
      });
    }

    return recs;
  }

  /**
   * Aggregate insights across all videos to produce channel-level patterns
   */
  static aggregateChannelInsights(channelId) {
    const insightFiles = [];
    ensureDir(ANALYTICS_DIR);
    try {
      const { readdirSync } = require('fs');
      const files = readdirSync(ANALYTICS_DIR)
        .filter((f) => f.startsWith(`retention_${channelId}_`) && f.endsWith('.json'));
      for (const f of files) {
        const data = readJSON(path.join(ANALYTICS_DIR, f));
        if (data) insightFiles.push(data);
      }
    } catch { /* no data yet */ }

    if (insightFiles.length === 0) return null;

    const avgAVD = average(insightFiles.map((i) => i.avd));
    const allDropPoints = insightFiles.flatMap((i) => i.dropOffPoints || []);
    const mostCommonDropZone = allDropPoints.length > 0
      ? Math.round(average(allDropPoints.map((d) => d.percentThrough)))
      : null;

    return {
      channelId,
      videosAnalyzed: insightFiles.length,
      avgAVD,
      avgAVDPercent: Math.round(avgAVD * 100),
      mostCommonDropZonePercent: mostCommonDropZone,
      recommendations: RetentionAnalyzer.generateChannelLevelRecs(avgAVD, mostCommonDropZone)
    };
  }

  static generateChannelLevelRecs(avgAVD, dropZone) {
    const recs = [];
    if (avgAVD < 0.40) recs.push('Reduce average video length by 20% — channel-wide retention issue');
    if (dropZone && dropZone < 25) recs.push('Hook problem across channel — test 3 different opening styles next 5 videos');
    if (dropZone && dropZone > 60) recs.push('Strong mid-video performance — extend valuable middle sections in next batch');
    return recs;
  }
}
