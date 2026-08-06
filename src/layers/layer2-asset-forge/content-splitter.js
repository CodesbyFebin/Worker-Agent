/**
 * Content Splitter — Traffic Tornado Strategy
 *
 * Splits a single Pillar script into 3 content formats:
 *
 *  1. PILLAR  (15 min): Full deep-dive for watch hours
 *  2. SNIPPET (4-5 min): Condensed version for secondary channel
 *  3. SHORT   (55 sec):  Vertical cut for YouTube Shorts
 *
 * The Short auto-generates a pinned comment linking to the Pillar,
 * creating a traffic funnel: Shorts → Subscribers → Watch Hours
 */

import logger from '../../utils/logger.js';

const log = logger.layer('ContentSplitter');

const SPEECH_WPM = 145;

export class ContentSplitter {

  /**
   * Split a pillar script into all 3 content versions
   */
  static async split(pillarScript, niche) {
    log.info(`Splitting script ${pillarScript.id} into Pillar/Snippet/Short`);

    const pillar = ContentSplitter.buildPillar(pillarScript, niche);
    const snippet = ContentSplitter.buildSnippet(pillarScript, niche);
    const short = ContentSplitter.buildShort(pillarScript, niche);

    log.info([
      `Pillar: ~${pillar.estimatedDurationMinutes}min`,
      `Snippet: ~${snippet.estimatedDurationMinutes}min`,
      `Short: ~${short.estimatedDurationSeconds}sec`
    ].join(' | '));

    return { pillar, snippet, short };
  }

  /**
   * Pillar — the full script as-is, with all sections
   */
  static buildPillar(script, niche) {
    return {
      ...script,
      versionType: 'pillar',
      estimatedDurationMinutes: script.estimatedDurationMinutes,
      uploadPriority: 1, // Upload first — anchors the funnel
      description: 'Full in-depth video for watch hours accumulation'
    };
  }

  /**
   * Snippet — key sections only, targeting ~4-5 minutes
   */
  static buildSnippet(script, niche) {
    const targetWords = Math.round(4.5 * SPEECH_WPM); // ~4.5 min

    // Keep: hook + 2 most important middle sections + cta
    const sections = script.segments
      .filter((s) => !s.isRetentionHook)
      .reduce((acc, seg) => {
        acc[seg.section] = acc[seg.section] || [];
        acc[seg.section].push(seg);
        return acc;
      }, {});

    const sectionNames = Object.keys(sections);
    const keepSections = [
      sectionNames[0],                                       // Always keep hook
      sectionNames[Math.floor(sectionNames.length * 0.3)],  // Early key section
      sectionNames[Math.floor(sectionNames.length * 0.6)],  // Mid key section
      sectionNames[sectionNames.length - 1]                 // Always keep CTA
    ].filter(Boolean);

    let selectedSegments = [];
    let wordCount = 0;

    for (const sectionName of keepSections) {
      const segs = sections[sectionName] || [];
      for (const seg of segs) {
        if (wordCount + seg.wordCount <= targetWords) {
          selectedSegments.push(seg);
          wordCount += seg.wordCount;
        }
      }
    }

    // Add transition text between snippet sections
    selectedSegments = ContentSplitter.addSnippetTransitions(selectedSegments);

    return {
      id: script.id + '_snippet',
      versionType: 'snippet',
      keyword: script.keyword,
      nicheId: script.nicheId,
      segments: selectedSegments,
      fullText: selectedSegments.map((s) => s.text).join('\n\n'),
      wordCount,
      estimatedDurationSeconds: Math.round((wordCount / SPEECH_WPM) * 60),
      estimatedDurationMinutes: Math.round((wordCount / SPEECH_WPM) * 10) / 10,
      uploadPriority: 3,
      description: 'Condensed version for secondary channel or repurposing'
    };
  }

  /**
   * Short — 55-second hook-driven vertical video
   */
  static buildShort(script, niche) {
    const targetWords = Math.round((55 / 60) * SPEECH_WPM); // ~55 seconds

    // Shorts formula: Hook (5s) → Value Bomb (40s) → CTA (10s)
    const hookSegment = script.segments.find((s) => s.section === 'hook' && !s.isRetentionHook);
    const valueBombSegments = script.segments
      .filter((s) => !s.isRetentionHook && s.section !== 'hook')
      .slice(1, 3); // Take 2 value-dense sections

    const ctaText = `Follow for more ${niche.category} tips! And watch the full breakdown — link in comments! 👆`;

    // Build short segments
    const shortSegments = [];
    let wordCount = 0;

    // 1. Hook (shortened to first 2 sentences)
    if (hookSegment) {
      const shortHook = ContentSplitter.shortenToSentences(hookSegment.text, 2);
      shortSegments.push({
        ...hookSegment,
        text: shortHook,
        wordCount: shortHook.split(' ').length,
        pace: 'fast'
      });
      wordCount += shortHook.split(' ').length;
    }

    // 2. Value bomb (most impactful insight)
    for (const seg of valueBombSegments) {
      if (wordCount + seg.wordCount > targetWords - 15) break;
      const condensed = ContentSplitter.shortenToSentences(seg.text, 3);
      shortSegments.push({
        ...seg,
        text: condensed,
        wordCount: condensed.split(' ').length,
        pace: 'fast'
      });
      wordCount += condensed.split(' ').length;
    }

    // 3. CTA
    shortSegments.push({
      section: 'cta',
      text: ctaText,
      emotion: 'excited',
      pace: 'fast',
      wordCount: ctaText.split(' ').length,
      estimatedDurationSeconds: 8,
      brollCues: []
    });

    const totalWords = shortSegments.reduce((s, seg) => s + seg.wordCount, 0);

    return {
      id: script.id + '_short',
      versionType: 'short',
      keyword: script.keyword,
      nicheId: script.nicheId,
      segments: shortSegments,
      fullText: shortSegments.map((s) => s.text).join('\n\n'),
      wordCount: totalWords,
      estimatedDurationSeconds: Math.min(Math.round((totalWords / SPEECH_WPM) * 60), 58),
      estimatedDurationMinutes: null,
      isVertical: true,
      aspectRatio: '9:16',
      pillarVideoRef: script.id,    // Links back to pillar for traffic funnel
      uploadPriority: 2,            // Upload soon after pillar
      description: 'YouTube Shorts vertical cut — drives traffic to Pillar via pinned comment',
      pinnedCommentTemplate: `🔥 Watch the FULL ${script.keyword} breakdown → [PILLAR_URL] 👆\n\nDrop a comment if you want Part 2! 👇`
    };
  }

  /**
   * Add smooth transitions between snippet sections
   */
  static addSnippetTransitions(segments) {
    const transitions = [
      "Let me quickly cover the most important part —",
      "Here's the key takeaway you need to know —",
      "Cutting to the chase —"
    ];

    const result = [];
    for (let i = 0; i < segments.length; i++) {
      if (i > 0 && i < segments.length - 1) {
        const transition = transitions[i % transitions.length];
        result.push({
          section: 'transition',
          text: transition,
          emotion: 'calm',
          pace: 'medium',
          wordCount: transition.split(' ').length,
          estimatedDurationSeconds: 4,
          isTransition: true,
          brollCues: []
        });
      }
      result.push(segments[i]);
    }
    return result;
  }

  /**
   * Shorten text to N sentences
   */
  static shortenToSentences(text, n) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.slice(0, n).join(' ').trim();
  }
}
