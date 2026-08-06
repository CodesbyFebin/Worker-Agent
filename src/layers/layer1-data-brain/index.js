/**
 * Layer 1 — Data Brain
 * The intelligence core of CC-OS.
 *
 * Responsibilities:
 *  - Scrape and predict rising trends 72h before they peak
 *  - YouTube autocomplete keyword mining
 *  - Sentiment analysis on trending topics
 *  - Niche profile loading and matching
 *  - Competitor channel analysis
 *  - Micro-node tagging for viewer cohort surfacing
 */

export { TrendScraper } from './trend-scraper.js';
export { KeywordPredictor } from './keyword-predictor.js';
export { SentimentAnalyzer } from './sentiment-analyzer.js';
export { NicheProfiler } from './niche-profiler.js';
export { CompetitorAnalyzer } from './competitor-analyzer.js';
export { MicroNodeTagger } from './micro-node-tagger.js';

/**
 * Run a full Data Brain cycle for a given niche
 * Returns a ranked list of content opportunities
 */
export async function runDataBrainCycle(nicheId, options = {}) {
  const { TrendScraper } = await import('./trend-scraper.js');
  const { KeywordPredictor } = await import('./keyword-predictor.js');
  const { SentimentAnalyzer } = await import('./sentiment-analyzer.js');
  const { NicheProfiler } = await import('./niche-profiler.js');
  const { MicroNodeTagger } = await import('./micro-node-tagger.js');

  const niche = await NicheProfiler.load(nicheId);
  const trends = await TrendScraper.fetchForNiche(niche, options);
  const keywords = await KeywordPredictor.expand(trends, niche);
  const sentiment = await SentimentAnalyzer.score(keywords);
  const tagged = await MicroNodeTagger.tag(keywords, niche);

  // Combine into content opportunities ranked by opportunity score
  const opportunities = tagged.map((item) => ({
    ...item,
    opportunityScore: calculateOpportunityScore(item, sentiment),
    niche: niche.id,
    generatedAt: new Date().toISOString()
  }));

  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return opportunities;
}

/**
 * Opportunity score formula:
 * (trend velocity × sentiment positivity × keyword volume) / competition score
 */
function calculateOpportunityScore(item, sentimentMap) {
  const velocity = item.trendVelocity || 0.5;
  const sentiment = sentimentMap[item.keyword] ?? 0.5;
  const volume = normalizeVolume(item.searchVolume || 1000);
  const competition = item.competitionScore || 0.5;

  return (velocity * 0.4 + sentiment * 0.2 + volume * 0.3) / Math.max(competition, 0.1) * 0.1;
}

function normalizeVolume(volume) {
  // Log-normalize search volume to 0-1 range
  return Math.min(Math.log10(volume) / 6, 1);
}
