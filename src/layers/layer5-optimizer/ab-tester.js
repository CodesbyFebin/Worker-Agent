/**
 * A/B Tester
 *
 * Tests thumbnail and title variants against each other using
 * real YouTube Analytics data as the signal.
 *
 * Test lifecycle:
 *  1. CREATED   — Two variants uploaded, test window starts
 *  2. ACTIVE    — Collecting CTR data for AB_TEST_WINDOW_HOURS
 *  3. RESOLVED  — Winner declared, losing variant updated via API
 *  4. ARCHIVED  — Data saved to prompt history for self-improver
 */

import path from 'path';
import fs from 'fs';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('ABTester');
const AB_DIR = './data/ab-tests';
const WINDOW_HOURS = parseInt(process.env.AB_TEST_WINDOW_HOURS || '48', 10);
const MIN_IMPRESSIONS = 100;

export class ABTester {

  static async createTest(channelId, videoId, variants) {
    ensureDir(AB_DIR);
    const testId = `${channelId}_${videoId}_${Date.now()}`;
    const test = {
      testId, channelId, videoId, status: 'active',
      variants: variants.map((v, i) => ({
        variantId: `v${i + 1}`,
        title: v.title,
        thumbnailPath: v.thumbnailPath,
        thumbnailId: v.thumbnailId,
        impressions: 0, clicks: 0, ctr: 0,
        isActive: i === 0
      })),
      activeVariantIndex: 0,
      createdAt: new Date().toISOString(),
      resolveAfter: new Date(Date.now() + WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
      winner: null, result: null
    };
    writeJSON(path.join(AB_DIR, `${testId}.json`), test);
    log.info(`A/B test created: ${testId} (window: ${WINDOW_HOURS}h)`);
    return test;
  }

  static async updateMetrics(testId, variantMetrics) {
    const testPath = path.join(AB_DIR, `${testId}.json`);
    const test = readJSON(testPath);
    if (!test || test.status !== 'active') return;
    for (const [variantId, metrics] of Object.entries(variantMetrics)) {
      const variant = test.variants.find((v) => v.variantId === variantId);
      if (variant) {
        variant.impressions = metrics.impressions || 0;
        variant.clicks = metrics.clicks || 0;
        variant.ctr = variant.impressions > 0 ? variant.clicks / variant.impressions : 0;
      }
    }
    test.lastUpdated = new Date().toISOString();
    writeJSON(testPath, test);
  }

  static async resolveActiveTests() {
    const resolved = [];
    const now = new Date();
    const tests = ABTester.loadAllTests();
    for (const test of tests) {
      if (test.status !== 'active') continue;
      if (new Date(test.resolveAfter) > now) continue;
      const result = ABTester.determineWinner(test);
      test.status = 'resolved';
      test.winner = result.winner;
      test.result = result;
      test.resolvedAt = new Date().toISOString();
      writeJSON(path.join(AB_DIR, `${test.testId}.json`), test);
      log.info(`Test resolved: ${test.testId} → ${result.winner || 'inconclusive'} (${(result.improvement * 100).toFixed(1)}% lift)`);
      resolved.push(test);
    }
    return resolved;
  }

  static determineWinner(test) {
    const eligible = test.variants.filter((v) => v.impressions >= MIN_IMPRESSIONS);
    if (eligible.length < 2) return { winner: null, reason: 'insufficient_impressions', winnerCTR: 0, improvement: 0 };
    const sorted = [...eligible].sort((a, b) => b.ctr - a.ctr);
    const best = sorted[0];
    const baseline = sorted[sorted.length - 1];
    const improvement = baseline.ctr > 0 ? (best.ctr - baseline.ctr) / baseline.ctr : 0;
    if (improvement < 0.10) return { winner: null, reason: 'no_significant_difference', winnerCTR: best.ctr, improvement };
    return { winner: best.variantId, winnerTitle: best.title, winnerCTR: best.ctr, loserCTR: baseline.ctr, improvement, reason: 'significant_ctr_lift' };
  }

  static getResolvedInsights(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const tests = ABTester.loadAllTests()
      .filter((t) => t.status === 'resolved' && t.winner && t.resolvedAt && new Date(t.resolvedAt) >= cutoff);
    const improvements = tests.map((t) => t.result?.improvement || 0).filter((i) => i > 0);
    return {
      totalTests: tests.length,
      successRate: tests.length > 0 ? tests.filter((t) => t.result?.reason === 'significant_ctr_lift').length / tests.length : 0,
      avgCTRImprovement: improvements.length > 0 ? improvements.reduce((a, b) => a + b, 0) / improvements.length : 0,
      winningTitles: tests.slice(-10).map((t) => ({ title: t.result?.winnerTitle, ctr: t.result?.winnerCTR, improvement: t.result?.improvement })).filter((t) => t.title)
    };
  }

  static loadAllTests() {
    ensureDir(AB_DIR);
    try {
      return fs.readdirSync(AB_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => readJSON(path.join(AB_DIR, f)))
        .filter(Boolean);
    } catch { return []; }
  }
}
