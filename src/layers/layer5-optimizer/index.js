/**
 * Layer 5 — Adaptive Optimizer
 * The self-improving feedback loop.
 *
 * Responsibilities:
 *  - A/B test thumbnails and titles with real YouTube analytics data
 *  - Retention curve analysis per video segment
 *  - Self-improving prompt engine (adjusts generation params based on AVD)
 *  - Rapid Pivot Protocol (under-performing video rescue within 2 hours)
 *  - Comment engagement automation (NLP-powered reply bot)
 *  - Monetization performance tracking and CPM optimization
 */

export { ABTester } from './ab-tester.js';
export { RetentionAnalyzer } from './retention-analyzer.js';
export { SelfImprover } from './self-improver.js';
export { RapidPivot } from './rapid-pivot.js';
export { CommentBot } from './comment-bot.js';

/**
 * Run a full optimization cycle across all channels
 */
export async function runOptimizationCycle() {
  const { ABTester } = await import('./ab-tester.js');
  const { RetentionAnalyzer } = await import('./retention-analyzer.js');
  const { SelfImprover } = await import('./self-improver.js');
  const { RapidPivot } = await import('./rapid-pivot.js');

  const [abResults, retentionInsights] = await Promise.allSettled([
    ABTester.resolveActiveTests(),
    RetentionAnalyzer.analyzeAll()
  ]);

  await SelfImprover.updateFromInsights(
    abResults.value,
    retentionInsights.value
  );

  await RapidPivot.checkAllVideos();

  return {
    abTestsResolved: abResults.value?.length || 0,
    retentionInsights: retentionInsights.value?.length || 0,
    completedAt: new Date().toISOString()
  };
}
