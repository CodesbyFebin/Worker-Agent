/**
 * Sentiment Analyzer
 *
 * Analyzes sentiment of keywords and topics to:
 *  - Avoid toxic/negative trending topics (demonetization risk)
 *  - Identify emotionally charged topics that drive engagement
 *  - Score "virality potential" based on emotional resonance
 *  - Map emotion categories: curiosity, excitement, fear, nostalgia, inspiration
 */

import Sentiment from 'sentiment';
import logger from '../../utils/logger.js';

const log = logger.layer('SentimentAnalyzer');
const sentimentEngine = new Sentiment();

// Emotion category word maps — extended for YouTube virality patterns
const EMOTION_MAP = {
  curiosity: [
    'secret', 'hidden', 'unknown', 'truth', 'reveal', 'exposed', 'discovered',
    'mystery', 'surprising', 'shocking', 'nobody knows', 'untold', 'underground'
  ],
  excitement: [
    'amazing', 'incredible', 'insane', 'unbelievable', 'mind blowing', 'epic',
    'game changer', 'revolutionary', 'breakthrough', 'unprecedented', 'legendary'
  ],
  urgency: [
    'before it\'s too late', 'now', 'immediately', 'urgent', 'hurry', 'limited',
    'last chance', 'expires', 'deadline', 'don\'t miss', 'ending soon'
  ],
  fear: [
    'warning', 'danger', 'avoid', 'mistake', 'scam', 'threat', 'risk',
    'collapse', 'fail', 'losing', 'disaster', 'problem', 'bad'
  ],
  nostalgia: [
    'remember', 'throwback', 'classic', 'old school', 'vintage', 'retro',
    'back in the day', 'used to', 'childhood', 'original', 'first'
  ],
  inspiration: [
    'transform', 'change your life', 'success', 'achieve', 'goal', 'dream',
    'possible', 'powerful', 'motivat', 'inspiring', 'overcome', 'journey'
  ],
  social_proof: [
    'everyone', 'millions', 'viral', 'trending', 'popular', 'famous',
    'celebrity', 'billionaire', 'expert', 'pro', 'master', 'guru'
  ]
};

// Demonetization risk words (these reduce ad-friendliness)
const DEMONETIZATION_TRIGGERS = [
  'suicide', 'murder', 'rape', 'bomb', 'terrorist', 'kill', 'dead', 'death',
  'drugs', 'cocaine', 'porn', 'sex', 'explicit', 'gore', 'torture',
  'nazis', 'racist', 'hate', 'extremist', 'violence'
];

export class SentimentAnalyzer {

  /**
   * Score a list of keywords with sentiment and emotion data
   * Returns a map of keyword → sentiment data
   */
  static score(keywords) {
    const results = {};

    for (const item of keywords) {
      const kw = typeof item === 'string' ? item : item.keyword;
      const analysis = SentimentAnalyzer.analyzeKeyword(kw);
      results[kw] = analysis.normalizedScore;
    }

    return results;
  }

  /**
   * Full analysis of a single keyword/phrase
   */
  static analyzeKeyword(text) {
    const raw = sentimentEngine.analyze(text);
    const normalizedScore = (raw.score + 5) / 10; // Normalize -5..5 to 0..1

    const emotions = SentimentAnalyzer.detectEmotions(text);
    const demonetizationRisk = SentimentAnalyzer.checkDemonetizationRisk(text);
    const viralityScore = SentimentAnalyzer.calculateViralityScore(emotions, normalizedScore, demonetizationRisk);

    return {
      text,
      rawScore: raw.score,
      normalizedScore: Math.max(0, Math.min(1, normalizedScore)),
      comparative: raw.comparative,
      emotions,
      dominantEmotion: SentimentAnalyzer.getDominantEmotion(emotions),
      demonetizationRisk,
      viralityScore,
      isAdFriendly: demonetizationRisk < 0.3,
      positiveWords: raw.positive,
      negativeWords: raw.negative
    };
  }

  /**
   * Detect emotion categories present in text
   */
  static detectEmotions(text) {
    const lowerText = text.toLowerCase();
    const detected = {};

    for (const [emotion, words] of Object.entries(EMOTION_MAP)) {
      let score = 0;
      for (const word of words) {
        if (lowerText.includes(word)) {
          score += 1 / words.length;
        }
      }
      if (score > 0) {
        detected[emotion] = Math.min(score * 3, 1.0); // Scale up for sensitivity
      }
    }

    return detected;
  }

  /**
   * Get the single most dominant emotion
   */
  static getDominantEmotion(emotions) {
    if (!Object.keys(emotions).length) return 'neutral';
    return Object.entries(emotions).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  }

  /**
   * Calculate demonetization risk (0 = safe, 1 = high risk)
   */
  static checkDemonetizationRisk(text) {
    const lowerText = text.toLowerCase();
    let riskScore = 0;

    for (const trigger of DEMONETIZATION_TRIGGERS) {
      if (lowerText.includes(trigger)) {
        riskScore += 0.2;
      }
    }

    return Math.min(riskScore, 1.0);
  }

  /**
   * Calculate virality potential score (0-1)
   * High-emotion + high-engagement signals = high virality
   */
  static calculateViralityScore(emotions, sentiment, demonetizationRisk) {
    // Emotion diversity boosts virality
    const emotionCount = Object.keys(emotions).length;
    const emotionBoost = emotionCount * 0.08;

    // High curiosity and urgency are the strongest virality signals
    const curiosityBoost = (emotions.curiosity || 0) * 0.25;
    const urgencyBoost = (emotions.urgency || 0) * 0.15;
    const excitementBoost = (emotions.excitement || 0) * 0.15;

    // Slightly positive sentiment (not too negative, not bland)
    const sentimentBoost = sentiment > 0.3 && sentiment < 0.8 ? 0.15 : 0;

    // Demonetization risk kills virality potential for our purposes
    const riskPenalty = demonetizationRisk * 0.5;

    const raw = 0.3 + emotionBoost + curiosityBoost + urgencyBoost + excitementBoost + sentimentBoost - riskPenalty;
    return Math.max(0, Math.min(1, raw));
  }

  /**
   * Filter a keyword list to keep only ad-friendly, high-virality candidates
   */
  static filterAndRank(keywords, minViralityScore = 0.3, maxDemonetizationRisk = 0.2) {
    const analyzed = keywords.map((kw) => ({
      ...kw,
      sentiment: SentimentAnalyzer.analyzeKeyword(typeof kw === 'string' ? kw : kw.keyword)
    }));

    return analyzed
      .filter((item) => {
        const s = item.sentiment;
        return s.isAdFriendly && s.viralityScore >= minViralityScore && s.demonetizationRisk <= maxDemonetizationRisk;
      })
      .sort((a, b) => b.sentiment.viralityScore - a.sentiment.viralityScore);
  }

  /**
   * Analyze title variants and return the highest virality option
   */
  static selectBestTitle(titles) {
    const scored = titles.map((title) => ({
      title,
      ...SentimentAnalyzer.analyzeKeyword(title)
    }));

    scored.sort((a, b) => b.viralityScore - a.viralityScore);

    log.debug(`Best title selected: "${scored[0]?.title}" (virality: ${scored[0]?.viralityScore?.toFixed(2)})`);
    return scored[0];
  }

  /**
   * Generate emotion-matched title prefixes for a given dominant emotion
   */
  static getTitlePrefixForEmotion(emotion) {
    const prefixes = {
      curiosity: ['Why Nobody Tells You About', 'The Hidden Truth About', 'What They Don\'t Want You to Know About'],
      excitement: ['This Changed Everything About', 'Incredible Results With', 'Mind-Blowing'],
      urgency: ['Do This NOW Before', 'Stop Making This Mistake With', 'You NEED to See This About'],
      fear: ['WARNING: Avoid This', 'The Dangerous Truth About', 'Why You\'re Failing At'],
      nostalgia: ['Remember When', 'The Classic Guide to', 'Old School'],
      inspiration: ['How I Transformed My', 'The Journey to Mastering', 'How Anyone Can Achieve'],
      social_proof: ['Why Millions Are Switching to', 'What Experts Say About', 'The Method Billionaires Use for'],
      neutral: ['The Complete Guide to', 'Everything You Need to Know About', 'A Deep Dive Into']
    };

    return prefixes[emotion] || prefixes.neutral;
  }
}
