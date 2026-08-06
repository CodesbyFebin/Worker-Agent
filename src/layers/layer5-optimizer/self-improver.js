/**
 * Self-Improving Prompt Engine
 *
 * The most powerful feature in CC-OS. Tracks which generation
 * parameters produce the best performing videos and automatically
 * updates the prompt templates for future generations.
 *
 * Learning signals:
 *  - AVD (Average View Duration) → adjust script length + hook density
 *  - CTR → update title patterns and thumbnail styles
 *  - Like rate → adjust content angle and tone
 *  - Comment rate → adjust CTA placement and community hooks
 *  - A/B test winners → catalog winning patterns
 *
 * Output: Updated prompt parameters stored per niche profile
 * These are injected into Layer 2 generation on the next cycle.
 */

import path from 'path';
import { readJSON, writeJSON, ensureDir, average } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('SelfImprover');
const HISTORY_DIR = './data/prompt-history';
const NICHES_DIR = './data/niches';

export class SelfImprover {

  /**
   * Main update cycle — called after every optimization cycle
   */
  static async updateFromInsights(abResults, retentionInsights) {
    if (!process.env.SELF_IMPROVEMENT_ENABLED || process.env.SELF_IMPROVEMENT_ENABLED === 'false') {
      log.info('Self-improvement disabled via env flag');
      return;
    }

    log.info('Running self-improvement update cycle...');

    // Group insights by channel/niche
    const channelInsights = {};

    for (const insight of (retentionInsights || [])) {
      if (!channelInsights[insight.channelId]) channelInsights[insight.channelId] = [];
      channelInsights[insight.channelId].push(insight);
    }

    for (const [channelId, insights] of Object.entries(channelInsights)) {
      await SelfImprover.updateChannelPromptParams(channelId, insights, abResults);
    }

    log.info('Self-improvement cycle complete');
  }

  /**
   * Update prompt parameters for a specific channel based on performance data
   */
  static async updateChannelPromptParams(channelId, retentionInsights, abResults) {
    const paramsPath = path.join(HISTORY_DIR, `params_${channelId}.json`);
    ensureDir(HISTORY_DIR);
    const current = readJSON(paramsPath) || SelfImprover.defaultParams();

    const avgAVD = average(retentionInsights.map((i) => i.avd || 0));
    const channelABResults = (abResults || []).filter((t) => t.channelId === channelId && t.winner);

    const updates = {};
    const learnings = [];

    // ─── AVD-based adjustments ─────────────────────────────────────────────
    if (avgAVD < 0.35) {
      // Low retention — shorten videos, increase hook frequency
      updates.targetDurationMultiplier = Math.max(0.7, (current.targetDurationMultiplier || 1.0) - 0.1);
      updates.retentionHookIntervalSeconds = Math.max(5, (current.retentionHookIntervalSeconds || 7) - 1);
      learnings.push(`Low AVD (${(avgAVD * 100).toFixed(0)}%) → reduced target duration, increased hook frequency`);
    } else if (avgAVD > 0.65) {
      // High retention — can increase depth, slightly longer videos
      updates.targetDurationMultiplier = Math.min(1.3, (current.targetDurationMultiplier || 1.0) + 0.05);
      learnings.push(`High AVD (${(avgAVD * 100).toFixed(0)}%) → increased depth multiplier`);
    }

    // ─── Drop-off pattern adjustments ──────────────────────────────────────
    const earlyDropVideos = retentionInsights.filter(
      (i) => i.dropOffPoints?.some((d) => d.percentThrough < 20)
    );
    if (earlyDropVideos.length > retentionInsights.length * 0.5) {
      // More than half of videos have early drops → hook problem
      updates.hookStyle = SelfImprover.rotateHookStyle(current.hookStyle);
      updates.introDurationTarget = Math.max(15, (current.introDurationTarget || 30) - 5);
      learnings.push('Consistent early drop-off → rotating hook style, shortening intro');
    }

    // ─── A/B test learnings ────────────────────────────────────────────────
    if (channelABResults.length > 0) {
      const winningTitles = channelABResults
        .map((t) => t.result?.winnerTitle)
        .filter(Boolean);

      if (winningTitles.length > 0) {
        // Analyze winning title patterns
        const hasNumbers = winningTitles.filter((t) => /\d+/.test(t)).length;
        const hasQuestion = winningTitles.filter((t) => /\?/.test(t)).length;
        const hasCaps = winningTitles.filter((t) => /[A-Z]{2,}/.test(t)).length;

        updates.titleGuidance = {
          preferNumbers: hasNumbers > winningTitles.length * 0.5,
          preferQuestion: hasQuestion > winningTitles.length * 0.4,
          preferCaps: hasCaps > winningTitles.length * 0.5,
          sampleWinners: winningTitles.slice(0, 3)
        };

        const avgImprovement = average(channelABResults.map((t) => t.result?.improvement || 0));
        learnings.push(`${channelABResults.length} A/B wins (avg +${(avgImprovement * 100).toFixed(1)}% CTR) → updated title guidance`);
      }
    }

    // ─── Persist updates ───────────────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      const newParams = {
        ...current,
        ...updates,
        channelId,
        learnings: [...(current.learnings || []).slice(-20), ...learnings],
        updateCount: (current.updateCount || 0) + 1,
        lastUpdated: new Date().toISOString()
      };

      writeJSON(paramsPath, newParams);
      log.info(`Channel ${channelId} prompt params updated: ${learnings.join('; ')}`);

      // Also update the niche profile's baseline metrics
      await SelfImprover.updateNicheBaseline(channelId, avgAVD);
    }

    return updates;
  }

  /**
   * Update niche profile with new performance baselines
   */
  static async updateNicheBaseline(channelId, avgAVD) {
    const nicheId = process.env[`CHANNEL_${channelId}_NICHE`] || `channel_${channelId}`;
    const nichePath = path.join(NICHES_DIR, `${nicheId}.json`);
    const niche = readJSON(nichePath);
    if (!niche) return;

    // Exponential moving average — blend new data with history
    const alpha = 0.3; // Learning rate
    if (niche.baselineMetrics) {
      niche.baselineMetrics.avgViewDuration = niche.baselineMetrics.avgViewDuration
        ? niche.baselineMetrics.avgViewDuration * (1 - alpha) + avgAVD * alpha
        : avgAVD;
    }

    niche.updatedAt = new Date().toISOString();
    writeJSON(nichePath, niche);
  }

  /**
   * Get current prompt parameters for a channel
   */
  static getParams(channelId) {
    const paramsPath = path.join(HISTORY_DIR, `params_${channelId}.json`);
    return readJSON(paramsPath) || SelfImprover.defaultParams();
  }

  /**
   * Rotate hook style to try a different approach
   */
  static rotateHookStyle(currentStyle) {
    const styles = ['stat_or_claim', 'controversial_truth', 'relatable_struggle', 'visual_hook', 'challenge_hook', 'dramatic_scene'];
    const currentIdx = styles.indexOf(currentStyle);
    return styles[(currentIdx + 1) % styles.length];
  }

  static defaultParams() {
    return {
      targetDurationMultiplier: 1.0,
      retentionHookIntervalSeconds: 7,
      introDurationTarget: 30,
      hookStyle: 'stat_or_claim',
      titleGuidance: { preferNumbers: true, preferQuestion: false, preferCaps: true },
      learnings: [],
      updateCount: 0,
      createdAt: new Date().toISOString()
    };
  }
}
