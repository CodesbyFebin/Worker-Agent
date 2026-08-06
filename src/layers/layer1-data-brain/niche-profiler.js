/**
 * Niche Profiler
 *
 * Loads, validates and manages niche profiles.
 * Each channel has a distinct niche profile that controls:
 *  - Tone, voice, and script style
 *  - Seed keywords and topic categories
 *  - Optimal video length and structure
 *  - Target audience demographics
 *  - Monetization strategy (ads, affiliate, digital products)
 *  - Upload schedule and timezone
 */

import path from 'path';
import { readJSON, writeJSON } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('NicheProfiler');
const NICHES_DIR = path.resolve('./data/niches');

export class NicheProfiler {

  /**
   * Load a niche profile by ID
   */
  static async load(nicheId) {
    const filePath = path.join(NICHES_DIR, `${nicheId}.json`);
    const profile = readJSON(filePath);

    if (!profile) {
      log.warn(`Niche profile "${nicheId}" not found — using default`);
      return NicheProfiler.getDefaultProfile(nicheId);
    }

    return NicheProfiler.validate(profile);
  }

  /**
   * Load all niche profiles for all 10 channels
   */
  static async loadAll() {
    const profiles = {};

    for (let i = 1; i <= 10; i++) {
      const channelId = String(i).padStart(2, '0');
      const nicheId = process.env[`CHANNEL_${channelId}_NICHE`] || `channel_${channelId}`;
      profiles[channelId] = await NicheProfiler.load(nicheId);
    }

    return profiles;
  }

  /**
   * Get the niche profile assigned to a specific channel number
   */
  static async getForChannel(channelNumber) {
    const channelId = String(channelNumber).padStart(2, '0');
    const nicheId = process.env[`CHANNEL_${channelId}_NICHE`] || `channel_${channelId}`;
    return NicheProfiler.load(nicheId);
  }

  /**
   * Save/update a niche profile
   */
  static async save(profile) {
    NicheProfiler.validate(profile);
    const filePath = path.join(NICHES_DIR, `${profile.id}.json`);
    writeJSON(filePath, { ...profile, updatedAt: new Date().toISOString() });
    log.info(`Saved niche profile: ${profile.id}`);
    return profile;
  }

  /**
   * Validate profile structure and fill defaults
   */
  static validate(profile) {
    const defaults = NicheProfiler.getDefaultProfile(profile.id);
    return { ...defaults, ...profile };
  }

  /**
   * Generate a default profile structure
   */
  static getDefaultProfile(id) {
    return {
      id: id || 'default',
      channelName: `Channel ${id}`,
      category: 'technology',

      // Voice and tone
      tone: 'conversational',           // conversational | educational | cinematic | investigative | motivational
      voiceGender: 'neutral',           // male | female | neutral
      speakingPace: 'medium',           // slow | medium | fast
      energyLevel: 'medium',            // low | medium | high
      personalityTraits: ['knowledgeable', 'friendly', 'direct'],

      // Content structure
      targetVideoDurationMinutes: 10,   // Pillar video target length
      shortVideoTargetSeconds: 55,      // YouTube Shorts target
      snippetDurationMinutes: 4,        // Snippet/B-channel length

      // Script structure controls
      introDurationSeconds: 30,         // Hook intro
      retentionHookIntervalSeconds: 7,  // How often to inject retention cues
      ctaPositions: [0.25, 0.75, 0.95], // CTA at 25%, 75%, 95% of video
      endCardDurationSeconds: 20,

      // SEO & Keywords
      seedKeywords: ['technology', 'gadgets', 'AI'],
      nicheKeywordModifiers: ['2026', 'best', 'review', 'guide'],
      microNodes: ['tech', 'productivity', 'innovation'],  // Viewer cohort tags
      subreddits: ['technology', 'gadgets'],

      // Audience
      targetAge: '18-35',
      targetGender: 'all',
      targetTimezone: 'America/New_York',
      optimalUploadHour: 15,           // 3pm local time
      uploadDaysOfWeek: [1, 3, 5],     // Mon, Wed, Fri

      // Upload schedule
      minUploadGapHours: 18,
      maxVideosPerWeek: 5,

      // Monetization
      monetizationStrategy: ['adsense', 'affiliate'],
      affiliateNiches: ['tech', 'software'],
      averageCPM: 4.0,                 // Estimated CPM in USD
      baseMonetizationScore: 0.6,
      competitionLevel: 0.5,           // 0 = blue ocean, 1 = red ocean

      // Content memory (for human-noise injection)
      channelPersona: {
        backstory: 'A tech enthusiast who reviews gadgets and shares productivity tips',
        quirks: ['often uses tech analogies', 'references personal experiments'],
        catchphrases: ['here\'s the thing', 'and that\'s the game changer'],
        regionalSlang: []
      },

      // Performance baselines (updated by optimizer)
      baselineMetrics: {
        avgCTR: 0.04,
        avgViewDuration: 0.45,
        avgLikes: 0.02,
        avgComments: 0.005
      },

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get tone-specific prompt system instruction
   */
  static getToneInstruction(tone) {
    const instructions = {
      conversational: 'Write in a casual, friendly conversational tone. Use "you" and "I". Include rhetorical questions. Sound like a knowledgeable friend, not a professor.',
      educational: 'Write in a clear, structured educational tone. Use numbered steps, clear definitions, and analogies. Sound authoritative but accessible.',
      cinematic: 'Write with dramatic pacing, tension, and storytelling. Use scene-setting language, suspenseful reveals, and emotional beats. Think documentary narrator.',
      investigative: 'Write like an investigative journalist. Build evidence, ask probing questions, reveal information progressively. Create a sense of uncovering truth.',
      motivational: 'Write with high energy and direct, actionable language. Use power words. Inspire action. Make the viewer feel capable and motivated.'
    };

    return instructions[tone] || instructions.conversational;
  }

  /**
   * Get niche-specific script template structure
   */
  static getScriptTemplate(niche) {
    const templates = {
      technology: {
        sections: ['hook', 'problem', 'solution_overview', 'deep_dive', 'real_world_test', 'verdict', 'cta'],
        hookStyle: 'stat_or_claim'
      },
      finance: {
        sections: ['hook', 'myth_bust', 'framework', 'step_by_step', 'case_study', 'action_plan', 'cta'],
        hookStyle: 'controversial_truth'
      },
      health: {
        sections: ['hook', 'the_problem', 'science_backed_solution', 'how_to_do_it', 'results_timeline', 'tips', 'cta'],
        hookStyle: 'relatable_struggle'
      },
      cooking: {
        sections: ['hook', 'ingredients_intro', 'prep', 'cooking_steps', 'tips_and_variations', 'taste_test', 'cta'],
        hookStyle: 'visual_hook'
      },
      gaming: {
        sections: ['hook', 'context', 'gameplay_breakdown', 'tips_and_tricks', 'comparison', 'final_verdict', 'cta'],
        hookStyle: 'challenge_hook'
      },
      'true-crime': {
        sections: ['hook', 'scene_setting', 'victim_background', 'the_crime', 'investigation', 'resolution', 'reflection'],
        hookStyle: 'dramatic_scene'
      }
    };

    return templates[niche.category] || templates.technology;
  }
}
