/**
 * Micro-Node Tagger
 *
 * The 2026 YouTube algorithm surfaces content based on "Viewer Cohorts" —
 * clusters of users who watch multiple topic combinations.
 *
 * Instead of tagging "Tech", we tag "Tech + Minimalism + Productivity Hacks"
 * which puts our video in front of MULTIPLE cohort buckets simultaneously.
 *
 * This module:
 *  - Generates multi-dimensional topic tags (Micro-Nodes)
 *  - Maps Micro-Nodes to viewer cohorts
 *  - Generates hashtag sets optimized for cohort surfacing
 *  - Creates "Easter Egg" phrases to encourage re-watches
 */

import OpenAI from 'openai';
import { retry } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('MicroNodeTagger');

// Pre-built cohort intersection maps
// Format: primaryNiche → compatible secondary niches (viewer overlap data)
const COHORT_MAP = {
  technology: ['productivity', 'minimalism', 'entrepreneurship', 'finance', 'sci-fi', 'gaming'],
  finance: ['entrepreneurship', 'real-estate', 'crypto', 'minimalism', 'self-improvement'],
  health: ['fitness', 'nutrition', 'mental-health', 'biohacking', 'sleep', 'meditation'],
  gaming: ['tech', 'pop-culture', 'esports', 'animation', 'reviews'],
  cooking: ['health', 'travel', 'culture', 'minimalism', 'budget-living'],
  'true-crime': ['psychology', 'history', 'mystery', 'documentary', 'justice'],
  fitness: ['health', 'nutrition', 'self-improvement', 'biohacking', 'mindset'],
  education: ['productivity', 'science', 'history', 'career', 'technology'],
  entertainment: ['pop-culture', 'comedy', 'celebrity', 'music', 'movies'],
  travel: ['culture', 'food', 'adventure', 'minimalism', 'photography']
};

// Easter Egg phrase templates — encourage re-watch behavior
const EASTER_EGG_TEMPLATES = [
  'By the way, I hid a bonus tip at the {position} mark — pause when you see it',
  'There\'s something most people miss at {position} in this video',
  'I\'m going to reveal the real answer at {position} — most people skip past it',
  'If you\'re still watching at {position}, I\'ll share something I\'ve never said publicly',
  'The most important part is at {position} — watch it twice if you have to'
];

export class MicroNodeTagger {

  /**
   * Tag a list of keywords with Micro-Nodes and cohort data
   */
  static async tag(keywords, niche) {
    log.info(`Tagging ${keywords.length} keywords with micro-nodes for niche: ${niche.id}`);

    const cohorts = COHORT_MAP[niche.category] || COHORT_MAP.technology;
    const primaryNodes = niche.microNodes || [niche.category];

    const tagged = keywords.map((item) => {
      const kw = typeof item === 'string' ? item : item.keyword;
      const secondaryNodes = MicroNodeTagger.selectSecondaryNodes(kw, cohorts, niche);
      const microNodes = [...new Set([...primaryNodes, ...secondaryNodes])];
      const hashtags = MicroNodeTagger.generateHashtags(microNodes, kw, niche);

      return {
        ...item,
        microNodes,
        primaryCohort: niche.category,
        secondaryCohorts: secondaryNodes,
        hashtags,
        videoTags: MicroNodeTagger.generateVideoTags(kw, niche, microNodes)
      };
    });

    return tagged;
  }

  /**
   * Select secondary cohort nodes based on keyword content analysis
   */
  static selectSecondaryNodes(keyword, availableCohorts, niche) {
    const kw = keyword.toLowerCase();
    const matched = [];

    // Keyword-to-cohort signal words
    const signals = {
      productivity: ['efficient', 'workflow', 'automat', 'tool', 'system', 'habit', 'routine', 'time'],
      minimalism: ['simple', 'clean', 'less is more', 'declutter', 'essentials', 'minimal'],
      entrepreneurship: ['business', 'startup', 'income', 'money', 'brand', 'revenue', 'side hustle'],
      finance: ['invest', 'money', 'wealth', 'budget', 'saving', 'stock', 'crypto', 'passive'],
      'self-improvement': ['improve', 'better', 'grow', 'success', 'skill', 'learn', 'master'],
      biohacking: ['optimize', 'sleep', 'supplement', 'brain', 'performance', 'longevity', 'fast'],
      'mental-health': ['stress', 'anxiety', 'focus', 'mindset', 'mental', 'wellness', 'calm'],
      'sci-fi': ['future', 'ai', 'robot', 'space', 'tech', 'virtual', 'simulation']
    };

    for (const cohort of availableCohorts) {
      const cohortSignals = signals[cohort] || [];
      if (cohortSignals.some((s) => kw.includes(s))) {
        matched.push(cohort);
      }
    }

    // Always include 2-3 secondary cohorts for maximum surfacing
    if (matched.length < 2) {
      const extras = availableCohorts.filter((c) => !matched.includes(c)).slice(0, 2);
      matched.push(...extras);
    }

    return matched.slice(0, 3);
  }

  /**
   * Generate optimized hashtag set (max 15 for YouTube)
   * Mix of: broad reach + niche-specific + trending
   */
  static generateHashtags(microNodes, keyword, niche) {
    const hashtags = new Set();

    // Add micro-node hashtags
    for (const node of microNodes) {
      hashtags.add(`#${node.replace(/[^a-zA-Z0-9]/g, '')}`);
    }

    // Add keyword-based hashtag
    const kwTag = keyword.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '');
    if (kwTag.length > 2 && kwTag.length < 30) {
      hashtags.add(`#${kwTag}`);
    }

    // Add niche category tag
    hashtags.add(`#${niche.category}`);

    // Add year tag (2026 algorithm signal)
    hashtags.add('#2026');

    // Add universal engagement tags
    const universalTags = ['#HowTo', '#Tutorial', '#Tips', '#Guide', '#Learn'];
    for (const tag of universalTags.slice(0, 3)) {
      hashtags.add(tag);
    }

    return Array.from(hashtags).slice(0, 15);
  }

  /**
   * Generate the full video tags array (500 char limit on YouTube)
   * Mix of exact match + broad + LSI tags
   */
  static generateVideoTags(keyword, niche, microNodes) {
    const tags = new Set();

    // Exact keyword tag
    tags.add(keyword);

    // Keyword variations
    tags.add(`${keyword} 2026`);
    tags.add(`${keyword} tutorial`);
    tags.add(`${keyword} guide`);
    tags.add(`best ${keyword}`);
    tags.add(`how to ${keyword}`);

    // Niche seed tags
    for (const seed of (niche.seedKeywords || []).slice(0, 5)) {
      tags.add(seed);
    }

    // Micro-node tags (broad reach)
    for (const node of microNodes) {
      tags.add(node);
      tags.add(`${node} tips`);
    }

    // Channel persona tags
    if (niche.channelPersona?.catchphrases) {
      // Don't include catchphrases as tags — they're too niche
    }

    // Trim to stay under YouTube's 500 char limit
    const tagArray = Array.from(tags);
    let totalLength = 0;
    const finalTags = [];

    for (const tag of tagArray) {
      if (totalLength + tag.length + 1 < 480) {
        finalTags.push(tag);
        totalLength += tag.length + 1;
      }
    }

    return finalTags;
  }

  /**
   * Generate "Easter Egg" re-watch phrases for a script
   * These encourage viewers to re-watch or seek specific timestamps
   */
  static generateEasterEggPhrases(videoDurationMinutes) {
    const positions = [
      `${Math.floor(videoDurationMinutes * 0.3)}:00`,
      `${Math.floor(videoDurationMinutes * 0.6)}:00`,
      `${Math.floor(videoDurationMinutes * 0.85)}:00`
    ];

    return EASTER_EGG_TEMPLATES.slice(0, 2).map((template, i) =>
      template.replace('{position}', positions[i] || '5:00')
    );
  }

  /**
   * AI-assisted micro-node expansion for complex topics
   */
  static async expandWithAI(keyword, niche) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return MicroNodeTagger.selectSecondaryNodes(keyword, COHORT_MAP[niche.category] || [], niche);
    }

    try {
      const openai = new OpenAI({ apiKey });
      const response = await retry(() =>
        openai.chat.completions.create({
          model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a YouTube audience targeting expert. Return only a JSON array of strings.'
            },
            {
              role: 'user',
              content: `What YouTube viewer interest categories overlap with someone searching for: "${keyword}" in the ${niche.category} space?
List 4 secondary interest categories from this list: [${(COHORT_MAP[niche.category] || []).join(', ')}]
Return ONLY a JSON array like: ["category1", "category2", ...]`
            }
          ],
          temperature: 0.5,
          max_tokens: 100
        })
      );

      const content = response.choices[0].message.content.trim();
      const match = content.match(/\[.*\]/s);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }
}
