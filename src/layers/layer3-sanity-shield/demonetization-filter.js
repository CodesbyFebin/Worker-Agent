/**
 * Demonetization Filter
 *
 * Scans scripts for words/phrases that trigger YouTube's "Limited Ads" flag
 * and auto-rewrites them with semantically equivalent ad-safe alternatives.
 *
 * Based on the known demonetization word lists used by major creators + YPP data.
 * Categories: Violence, Drugs, Politics, Adult, Disaster, Profanity, Controversial
 *
 * Auto-rewrite strategy:
 *  - Direct synonym replacement (fast)
 *  - AI contextual rewrite for complex phrases (accurate)
 *  - Euphemism injection for sensitive categories (safe)
 */

import OpenAI from 'openai';
import { retry } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('DemonetizationFilter');

// ─── Comprehensive demonetization word map ────────────────────────────────────
// Format: flaggedTerm → [safe alternatives]
const DEMONETIZATION_MAP = {
  // Violence
  'kill': ['eliminate', 'defeat', 'stop', 'end'],
  'killed': ['eliminated', 'defeated', 'stopped'],
  'killing': ['eliminating', 'defeating', 'removing'],
  'murder': ['crime', 'incident', 'case'],
  'murdered': ['harmed', 'victimized'],
  'shoot': ['capture', 'photograph', 'record'],
  'shooting': ['capturing', 'recording', 'filming'],
  'shot': ['captured', 'photographed', 'recorded'],
  'bomb': ['major impact', 'huge result', 'explosive growth'],
  'explosion': ['rapid expansion', 'massive growth', 'breakthrough'],
  'explode': ['surge', 'skyrocket', 'breakthrough'],
  'attack': ['challenge', 'approach', 'tackle', 'address'],
  'weapon': ['tool', 'resource', 'method'],
  'gun': ['device', 'tool', 'mechanism'],
  'dead': ['outdated', 'finished', 'past'],
  'death': ['end', 'conclusion', 'transition'],
  'die': ['stop working', 'end', 'fail'],
  'dying': ['fading', 'declining', 'ending'],
  'suicide': ['quitting', 'giving up', 'stopping'],
  'blood': ['effort', 'resource', 'energy'],
  'torture': ['challenging process', 'difficult experience'],
  'violence': ['confrontation', 'conflict', 'challenge'],
  'violent': ['intense', 'aggressive', 'strong'],
  'terrorist': ['bad actor', 'disruptor', 'threat'],
  'terrorism': ['disruption', 'threat', 'challenge'],
  'war': ['competition', 'battle', 'contest', 'conflict'],
  'rape': ['violation', 'breach', 'exploitation'],
  'abuse': ['misuse', 'overuse', 'mistreatment'],

  // Drugs
  'drug': ['supplement', 'substance', 'compound', 'product'],
  'drugs': ['supplements', 'substances', 'compounds'],
  'cocaine': ['stimulant', 'substance'],
  'heroin': ['substance', 'compound'],
  'marijuana': ['herb', 'plant', 'supplement'],
  'weed': ['herb', 'plant'],
  'overdose': ['excess', 'too much', 'overuse'],
  'addiction': ['dependency', 'reliance', 'habit'],
  'addict': ['someone dependent on', 'heavy user of'],
  'drunk': ['impaired', 'affected', 'influenced'],
  'alcohol': ['beverage', 'drink', 'liquid'],

  // Profanity (common)
  'shit': ['problem', 'stuff', 'thing', 'situation'],
  'damn': ['really', 'very', 'extremely'],
  'hell': ['chaos', 'mess', 'trouble'],
  'ass': ['bottom', 'backside', 'behind'],
  'crap': ['nonsense', 'low quality', 'poor'],
  'freaking': ['extremely', 'very', 'really'],
  'wtf': ['what\'s happening', 'unbelievable', 'surprising'],
  'f*ck': ['mess up', 'ruin', 'destroy'],

  // Politically sensitive
  'racist': ['discriminatory', 'biased', 'prejudiced'],
  'racism': ['discrimination', 'bias', 'prejudice'],
  'nazi': ['extremist', 'radical'],
  'genocide': ['mass harm', 'systematic destruction'],
  'extremist': ['radical', 'fringe group'],
  'propaganda': ['misleading content', 'biased narrative'],
  'fake news': ['misinformation', 'inaccurate reporting'],

  // Financial sensitive
  'scam': ['scheme', 'misleading practice', 'deceptive approach'],
  'fraud': ['deception', 'misleading practice'],
  'ponzi': ['unsustainable scheme', 'deceptive model'],
  'illegal': ['unauthorized', 'non-compliant', 'against the rules'],
  'money laundering': ['financial misconduct'],

  // Health misinformation triggers
  'cure': ['address', 'help with', 'improve', 'manage'],
  'cures': ['addresses', 'helps with', 'improves'],
  'treat cancer': ['help with health challenges', 'address health conditions'],
  'miracle': ['effective', 'powerful', 'transformative'],
  'guaranteed results': ['consistent results', 'proven results'],
};

// Terms that should trigger AI rewrite (context-dependent, not simple replace)
const CONTEXT_REWRITE_TRIGGERS = new Set([
  'killed it', 'killing it', 'on fire', 'crushed it', 'destroying',
  'going to war', 'battle plan', 'fight back', 'ammunition', 'target',
  'blow up', 'blew up', 'blowing up', 'fire back', 'shut down'
]);

export class DemonetizationFilter {

  /**
   * Scan a script and return sanitized version with score
   */
  static async scan(script, niche) {
    log.info(`Scanning script ${script.id} for demonetization risks`);

    let totalFlags = 0;
    const sanitizedSegments = [];
    const flagReport = [];

    for (const segment of script.segments) {
      const result = await DemonetizationFilter.sanitizeSegment(segment, niche);
      sanitizedSegments.push(result.segment);
      totalFlags += result.flagCount;
      if (result.flagCount > 0) {
        flagReport.push({ section: segment.section, flags: result.flags });
      }
    }

    const adFriendlinessScore = Math.max(0, 1.0 - (totalFlags * 0.05));

    log.info(`Scan complete: ${totalFlags} flags found, ad-friendliness: ${(adFriendlinessScore * 100).toFixed(0)}%`);

    return {
      sanitizedScript: { ...script, segments: sanitizedSegments },
      flaggedCount: totalFlags,
      flagReport,
      adFriendlinessScore
    };
  }

  /**
   * Sanitize a single segment
   */
  static async sanitizeSegment(segment, niche) {
    let text = segment.text;
    let flagCount = 0;
    const flags = [];

    // Phase 1: Direct word replacement (fast, no API call)
    for (const [flagged, alternatives] of Object.entries(DEMONETIZATION_MAP)) {
      const regex = new RegExp(`\\b${DemonetizationFilter.escapeRegex(flagged)}\\b`, 'gi');
      if (regex.test(text)) {
        const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
        text = text.replace(regex, replacement);
        flagCount++;
        flags.push(flagged);
      }
    }

    // Phase 2: Context-dependent rewrite (AI) for ambiguous phrases
    const needsContextRewrite = [...CONTEXT_REWRITE_TRIGGERS].some((t) =>
      text.toLowerCase().includes(t)
    );

    if (needsContextRewrite && process.env.OPENAI_API_KEY) {
      const rewritten = await DemonetizationFilter.aiContextRewrite(text, niche);
      if (rewritten) {
        text = rewritten;
        flagCount++;
        flags.push('context_rewrite');
      }
    }

    return {
      segment: { ...segment, text },
      flagCount,
      flags
    };
  }

  /**
   * AI-powered context-aware rewrite for phrases that can't be simply swapped
   */
  static async aiContextRewrite(text, niche) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await retry(() =>
        openai.chat.completions.create({
          model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Rewrite the text to be YouTube ad-friendly. Keep the same meaning but replace any slang, violence metaphors, or sensitive phrases with professional equivalents. Return ONLY the rewritten text.'
            },
            { role: 'user', content: text }
          ],
          temperature: 0.3,
          max_tokens: 300
        })
      );
      return response.choices[0].message.content.trim();
    } catch {
      return null;
    }
  }

  /**
   * Scan metadata (titles, descriptions) for demonetization risk
   */
  static scanMetadata(metadata) {
    const issues = [];

    const allText = [
      metadata.primaryTitle,
      ...(metadata.titles?.map((t) => t.title) || []),
      metadata.primaryDescription
    ].filter(Boolean).join(' ');

    for (const flagged of Object.keys(DEMONETIZATION_MAP)) {
      const regex = new RegExp(`\\b${DemonetizationFilter.escapeRegex(flagged)}\\b`, 'gi');
      if (regex.test(allText)) {
        issues.push(flagged);
      }
    }

    return {
      isClean: issues.length === 0,
      flaggedTerms: issues,
      riskScore: Math.min(issues.length * 0.1, 1.0)
    };
  }

  static escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
