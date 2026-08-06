/**
 * Uniqueness Checker
 *
 * Prevents YouTube's "Repetitive / Mass-Produced Content" flag by:
 *  1. Maintaining a content fingerprint database per channel
 *  2. Computing similarity scores between new content and history
 *  3. Blocking uploads that are too similar to recent videos
 *  4. Tracking structural patterns (section order, hook style variety)
 *
 * YouTube's repetitive content policy targets channels that:
 *  - Upload many videos with identical structure/scripts
 *  - Use the same intro/outro template verbatim
 *  - Have low unique word ratio across their library
 *
 * Our response: enforce minimum uniqueness thresholds and rotate structures.
 */

import crypto from 'crypto';
import path from 'path';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('UniquenessChecker');
const DATA_DIR = './data/analytics';

const MIN_UNIQUENESS_SCORE = 0.65;  // Below this = reject/regenerate
const SIMILARITY_BLOCK_THRESHOLD = 0.80; // Above this = definitely duplicate
const ROLLING_WINDOW = 20; // Compare against last 20 videos per channel

export class UniquenessChecker {

  /**
   * Check if a script is unique enough to upload
   */
  static async check(script, niche) {
    const channelId = niche.id;
    const history = UniquenessChecker.loadHistory(channelId);

    if (history.length === 0) {
      // First video — no comparison possible, proceed
      UniquenessChecker.saveToHistory(script, channelId, 1.0);
      return { isDuplicate: false, uniquenessScore: 1.0, similarity: 0, matchedId: null };
    }

    const scriptFingerprint = UniquenessChecker.fingerprint(script);
    const recentHistory = history.slice(-ROLLING_WINDOW);

    let highestSimilarity = 0;
    let mostSimilarId = null;

    for (const entry of recentHistory) {
      const similarity = UniquenessChecker.cosineSimilarity(
        scriptFingerprint.termVector,
        entry.termVector
      );

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        mostSimilarId = entry.scriptId;
      }
    }

    const uniquenessScore = 1.0 - highestSimilarity;
    const isDuplicate = highestSimilarity >= SIMILARITY_BLOCK_THRESHOLD;
    const isTooSimilar = uniquenessScore < MIN_UNIQUENESS_SCORE;

    // Check structural variety
    const structuralScore = UniquenessChecker.checkStructuralVariety(script, recentHistory);

    log.info(`Uniqueness check: ${(uniquenessScore * 100).toFixed(0)}% unique, structural: ${(structuralScore * 100).toFixed(0)}%`);

    if (!isDuplicate && !isTooSimilar) {
      UniquenessChecker.saveToHistory(script, channelId, uniquenessScore, scriptFingerprint);
    }

    return {
      isDuplicate: isDuplicate || isTooSimilar,
      uniquenessScore,
      similarity: highestSimilarity,
      matchedId: isDuplicate ? mostSimilarId : null,
      structuralScore,
      recommendation: isTooSimilar && !isDuplicate
        ? `Score ${(uniquenessScore * 100).toFixed(0)}% — regenerate with different angle or topic variation`
        : null
    };
  }

  /**
   * Generate a content fingerprint for a script
   */
  static fingerprint(script) {
    const fullText = script.segments
      ?.map((s) => s.text)
      .join(' ')
      .toLowerCase() || '';

    // Extract meaningful terms (exclude stop words, short words)
    const terms = fullText
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w));

    // Build TF (term frequency) vector
    const termFreq = {};
    for (const term of terms) {
      termFreq[term] = (termFreq[term] || 0) + 1;
    }

    // Normalize by total term count
    const total = terms.length || 1;
    for (const term of Object.keys(termFreq)) {
      termFreq[term] = termFreq[term] / total;
    }

    // Content hash for exact duplicate detection
    const hash = crypto.createHash('sha256').update(fullText.slice(0, 2000)).digest('hex');

    return {
      termVector: termFreq,
      hash,
      termCount: terms.length,
      uniqueTermCount: Object.keys(termFreq).length,
      keyword: script.keyword,
      sectionStructure: script.segments?.map((s) => s.section).join('-')
    };
  }

  /**
   * Cosine similarity between two term frequency vectors
   */
  static cosineSimilarity(vecA, vecB) {
    const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (const term of allTerms) {
      const a = vecA[term] || 0;
      const b = vecB[term] || 0;
      dotProduct += a * b;
      magA += a * a;
      magB += b * b;
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Check structural variety — ensures we're not using the same template every time
   */
  static checkStructuralVariety(script, history) {
    if (history.length < 3) return 1.0;

    const currentStructure = script.segments?.map((s) => s.section).join('-') || '';
    const recentStructures = history.slice(-5).map((h) => h.sectionStructure || '');

    const exactMatches = recentStructures.filter((s) => s === currentStructure).length;
    const variety = 1.0 - (exactMatches / recentStructures.length);

    return variety;
  }

  /**
   * Load channel content history from disk
   */
  static loadHistory(channelId) {
    const historyPath = path.join(DATA_DIR, `uniqueness_${channelId}.json`);
    const data = readJSON(historyPath);
    return data?.history || [];
  }

  /**
   * Save new script fingerprint to channel history
   */
  static saveToHistory(script, channelId, uniquenessScore, fingerprint = null) {
    const fp = fingerprint || UniquenessChecker.fingerprint(script);
    const historyPath = path.join(DATA_DIR, `uniqueness_${channelId}.json`);

    ensureDir(DATA_DIR);
    const data = readJSON(historyPath) || { history: [] };

    data.history.push({
      scriptId: script.id,
      keyword: script.keyword,
      hash: fp.hash,
      termVector: fp.termVector,
      sectionStructure: fp.sectionStructure,
      uniquenessScore,
      savedAt: new Date().toISOString()
    });

    // Keep only the rolling window in memory
    if (data.history.length > 50) {
      data.history = data.history.slice(-50);
    }

    writeJSON(historyPath, data);
  }

  /**
   * Get uniqueness statistics for a channel
   */
  static getChannelStats(channelId) {
    const history = UniquenessChecker.loadHistory(channelId);
    if (!history.length) return { totalVideos: 0, avgUniqueness: 0 };

    const scores = history.map((h) => h.uniquenessScore || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      totalVideos: history.length,
      avgUniqueness: avg,
      lastVideoAt: history[history.length - 1]?.savedAt,
      recentKeywords: history.slice(-5).map((h) => h.keyword)
    };
  }
}

const STOP_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'being', 'below', 'between',
  'both', 'cannot', 'could', 'doing', 'during', 'each', 'further', 'having',
  'here', 'itself', 'just', 'more', 'most', 'myself', 'only', 'other', 'over',
  'same', 'should', 'since', 'still', 'such', 'than', 'that', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under',
  'until', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will',
  'with', 'would', 'your', 'from', 'have', 'been', 'also', 'into', 'some',
  'like', 'just', 'know', 'take', 'make', 'come', 'want', 'going', 'actually'
]);
