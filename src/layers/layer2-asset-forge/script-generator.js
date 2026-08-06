/**
 * Script Generator — Dynamic Script Architecture (DSA)
 *
 * Core content engine. Every script is built with:
 *  1. Pattern-interrupt hook (first 30 seconds — critical for retention)
 *  2. Retention hooks injected every 7 seconds of speech
 *  3. Niche-specific section structure
 *  4. Easter egg phrases for re-watch signals
 *  5. CTA placement at 25%, 75%, and 95% marks
 *  6. Emotion modulation cues for TTS
 *  7. B-Roll action verb markers [BROLL: action]
 */

import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { retry, estimateSpeechDuration, writeJSON, shortId } from '../../utils/helpers.js';
import { NicheProfiler } from '../layer1-data-brain/niche-profiler.js';
import { MicroNodeTagger } from '../layer1-data-brain/micro-node-tagger.js';
import logger from '../../utils/logger.js';

const log = logger.layer('ScriptGenerator');

// Words per minute for speech duration calculation
const SPEECH_WPM = 145;
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

export class ScriptGenerator {

  /**
   * Generate a complete video script
   */
  static async generate(opportunity, niche, competitorAnalysis = null) {
    log.info(`Generating script for: "${opportunity.keyword}" [${niche.id}]`);

    const template = NicheProfiler.getScriptTemplate(niche);
    const toneInstruction = NicheProfiler.getToneInstruction(niche.tone);
    const easterEggs = MicroNodeTagger.generateEasterEggPhrases(niche.targetVideoDurationMinutes);

    const targetWords = Math.round(niche.targetVideoDurationMinutes * SPEECH_WPM);
    const wordsPerSection = Math.round(targetWords / template.sections.length);

    const prompt = ScriptGenerator.buildPrompt({
      keyword: opportunity.keyword,
      niche,
      template,
      toneInstruction,
      easterEggs,
      targetWords,
      wordsPerSection,
      competitorInsights: competitorAnalysis?.contentGaps || [],
      microNodes: opportunity.microNodes || niche.microNodes,
      emotionTarget: opportunity.sentiment?.dominantEmotion || 'curiosity'
    });

    let scriptText = '';

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      scriptText = await ScriptGenerator.generateWithAI(prompt, apiKey);
    } else {
      log.warn('OPENAI_API_KEY not set — using mock script');
      scriptText = ScriptGenerator.mockScript(opportunity.keyword, niche, template);
    }

    // Parse the raw script into structured segments
    const segments = ScriptGenerator.parseIntoSegments(scriptText, niche);

    // Inject retention hooks between segments
    const enrichedSegments = ScriptGenerator.injectRetentionHooks(segments, niche);

    // Tag each segment with B-Roll markers
    const taggedSegments = ScriptGenerator.tagBRollMarkers(enrichedSegments);

    // Add TTS emotion cues
    const finalSegments = ScriptGenerator.addEmotionCues(taggedSegments, niche);

    const totalWords = finalSegments.reduce((s, seg) => s + seg.text.split(' ').length, 0);
    const estimatedDurationSecs = Math.round((totalWords / SPEECH_WPM) * 60);

    const scriptObj = {
      id: shortId(),
      keyword: opportunity.keyword,
      nicheId: niche.id,
      title: opportunity.keyword, // Will be overridden by MetadataPackager
      segments: finalSegments,
      fullText: finalSegments.map((s) => s.text).join('\n\n'),
      wordCount: totalWords,
      estimatedDurationSeconds: estimatedDurationSecs,
      estimatedDurationMinutes: Math.round(estimatedDurationSecs / 60 * 10) / 10,
      template: template.sections,
      microNodes: opportunity.microNodes,
      generatedAt: new Date().toISOString()
    };

    // Persist to disk
    const outputPath = path.join(OUTPUT_DIR, 'scripts', `${scriptObj.id}_${niche.id}.json`);
    writeJSON(outputPath, scriptObj);
    log.info(`Script saved: ${outputPath} (${totalWords} words, ~${scriptObj.estimatedDurationMinutes}min)`);

    return scriptObj;
  }

  /**
   * Build the AI generation prompt
   */
  static buildPrompt({ keyword, niche, template, toneInstruction, easterEggs,
    targetWords, wordsPerSection, competitorInsights, microNodes, emotionTarget }) {

    const catchphrases = niche.channelPersona?.catchphrases?.join(', ') || 'none';
    const backstory = niche.channelPersona?.backstory || 'a content creator in this niche';
    const quirks = niche.channelPersona?.quirks?.join(', ') || 'none';
    const contentGapNote = competitorInsights.length
      ? `\n\nContent GAP opportunity — competitors are NOT covering these angles: ${competitorInsights.join(', ')}. INCORPORATE one of these.`
      : '';

    return `You are a professional YouTube scriptwriter with 10 years of experience.
Write a COMPLETE YouTube video script about: "${keyword}"

${toneInstruction}

CRITICAL STRUCTURE RULES:
1. The video has ${template.sections.length} sections: ${template.sections.join(' → ')}
2. Target total length: ${targetWords} words (~${niche.targetVideoDurationMinutes} minutes of speech at ${SPEECH_WPM} wpm)
3. Each section targets ~${wordsPerSection} words
4. HOOK (first section) must create pattern interrupt within the FIRST 3 SENTENCES. No slow intros. Start with a shocking stat, bold claim, or scene-setting moment.
5. Insert a RETENTION CUE every 7 speech-seconds (~17 words). Format: [HOOK: brief tease of what's coming next]
6. Insert B-ROLL markers for every visual action described. Format: [BROLL: specific visual description]
7. Place CTA (subscribe/like/comment) at the ${Math.round(template.sections.length * 0.25)}th and final sections.
8. End with a strong closing loop that references the opening hook.

CHANNEL PERSONA:
- Backstory: ${backstory}
- Catchphrases to use naturally: ${catchphrases}
- Personality quirks: ${quirks}
- Audience: ${niche.targetAge}, interested in: ${(microNodes || []).join(', ')}

EMOTION TARGET: ${emotionTarget} — write to evoke this emotion throughout

EASTER EGG PHRASES to weave in naturally (one per relevant section):
${easterEggs.map((e, i) => `${i + 1}. "${e}"`).join('\n')}
${contentGapNote}

FORMAT REQUIREMENTS:
- Label each section clearly: [SECTION: section_name]
- Label emotion cues: [EMOTION: excited/calm/mysterious/urgent/inspirational]
- Label TTS pace: [PACE: fast/medium/slow]
- NO stage directions (don't write "He looks at camera")
- Write ONLY spoken words + the bracket markers above
- Do NOT use markdown headers or bullet points in the spoken sections

Write the complete script now:`;
  }

  /**
   * Call OpenAI to generate the script
   */
  static async generateWithAI(prompt, apiKey) {
    const openai = new OpenAI({ apiKey });

    const response = await retry(() =>
      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert YouTube scriptwriter. Follow the format exactly. Write complete, engaging scripts that keep viewers watching.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.75,
        max_tokens: 4000
      })
    , 3, 2000);

    return response.choices[0].message.content;
  }

  /**
   * Parse raw script text into structured segments
   */
  static parseIntoSegments(rawText, niche) {
    const lines = rawText.split('\n');
    const segments = [];
    let currentSection = 'hook';
    let currentEmotion = 'curious';
    let currentPace = 'medium';
    let buffer = [];

    const flushBuffer = () => {
      const text = buffer.join(' ').trim();
      if (text.length > 10) {
        segments.push({
          section: currentSection,
          text,
          emotion: currentEmotion,
          pace: currentPace,
          wordCount: text.split(/\s+/).length,
          estimatedDurationSeconds: Math.round((text.split(/\s+/).length / SPEECH_WPM) * 60)
        });
      }
      buffer = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Section marker
      const sectionMatch = trimmed.match(/\[SECTION:\s*(.+?)\]/i);
      if (sectionMatch) {
        flushBuffer();
        currentSection = sectionMatch[1].toLowerCase().replace(/\s+/g, '_');
        continue;
      }

      // Emotion marker
      const emotionMatch = trimmed.match(/\[EMOTION:\s*(.+?)\]/i);
      if (emotionMatch) {
        flushBuffer();
        currentEmotion = emotionMatch[1].toLowerCase();
        continue;
      }

      // Pace marker
      const paceMatch = trimmed.match(/\[PACE:\s*(.+?)\]/i);
      if (paceMatch) {
        flushBuffer();
        currentPace = paceMatch[1].toLowerCase();
        continue;
      }

      // Inline hook cue — keep in text but also flag as retention point
      if (trimmed.startsWith('[HOOK:')) {
        flushBuffer();
        const hookText = trimmed.replace(/\[HOOK:\s*/i, '').replace(/\]$/, '');
        segments.push({
          section: currentSection,
          text: hookText,
          emotion: 'urgent',
          pace: 'fast',
          isRetentionHook: true,
          wordCount: hookText.split(/\s+/).length,
          estimatedDurationSeconds: 3
        });
        continue;
      }

      // B-Roll markers — store but don't add to TTS text
      if (trimmed.startsWith('[BROLL:')) {
        // Will be processed by BRollMatcher
        buffer.push(trimmed);
        continue;
      }

      buffer.push(trimmed);
    }

    flushBuffer();
    return segments;
  }

  /**
   * Inject retention micro-hooks between segments
   * These are 1-sentence teasers that make viewers stay for the next section
   */
  static injectRetentionHooks(segments, niche) {
    const retentionPhrases = [
      "But here's where it gets interesting —",
      "Wait — before we move on, there's something you need to see —",
      "And this is the part most people completely skip past —",
      "I'll get to the most surprising part in just a second, but first —",
      "Stick with me here, because this next part changes everything —",
      "Now, I know what you're thinking — but hold on —",
      "The real secret is actually in the next section —",
      "Here's what nobody in this space is talking about —"
    ];

    const enriched = [];

    for (let i = 0; i < segments.length; i++) {
      enriched.push(segments[i]);

      // Inject retention hook after every major section (except last)
      if (i < segments.length - 1 && !segments[i].isRetentionHook) {
        const phrase = retentionPhrases[i % retentionPhrases.length];
        enriched.push({
          section: 'retention_hook',
          text: phrase,
          emotion: 'urgent',
          pace: 'fast',
          isRetentionHook: true,
          wordCount: phrase.split(' ').length,
          estimatedDurationSeconds: 4
        });
      }
    }

    return enriched;
  }

  /**
   * Extract and tag B-Roll markers from segment text
   * Returns segments with brollCues array added
   */
  static tagBRollMarkers(segments) {
    return segments.map((seg) => {
      const brollCues = [];
      const cleanText = seg.text.replace(/\[BROLL:\s*(.*?)\]/gi, (match, desc) => {
        brollCues.push({
          description: desc.trim(),
          timestamp: 0 // Will be calculated during render
        });
        return ''; // Remove marker from spoken text
      }).trim();

      return { ...seg, text: cleanText, brollCues };
    });
  }

  /**
   * Add TTS-compatible emotion and pace markers to each segment
   */
  static addEmotionCues(segments, niche) {
    const emotionToStability = {
      excited: { stability: 0.3, similarity_boost: 0.8, style: 0.9 },
      calm: { stability: 0.8, similarity_boost: 0.7, style: 0.2 },
      mysterious: { stability: 0.6, similarity_boost: 0.8, style: 0.6 },
      urgent: { stability: 0.2, similarity_boost: 0.9, style: 1.0 },
      inspirational: { stability: 0.5, similarity_boost: 0.8, style: 0.7 },
      curious: { stability: 0.5, similarity_boost: 0.8, style: 0.5 },
      default: { stability: 0.5, similarity_boost: 0.75, style: 0.5 }
    };

    return segments.map((seg) => ({
      ...seg,
      ttsSettings: emotionToStability[seg.emotion] || emotionToStability.default
    }));
  }

  /**
   * Mock script for dev/testing without OpenAI
   */
  static mockScript(keyword, niche, template) {
    const sections = template.sections.map((section, i) => {
      const isFirst = i === 0;
      const isLast = i === template.sections.length - 1;

      let text = '';
      if (isFirst) {
        text = `[SECTION: ${section}]\n[EMOTION: urgent]\n[PACE: fast]\n` +
          `Did you know that 93% of people completely waste their time when it comes to ${keyword}? ` +
          `[BROLL: person looking frustrated at a screen] ` +
          `I'm going to show you exactly what they're doing wrong — and more importantly — what actually works. ` +
          `[HOOK: The #1 mistake is coming up in section 3]\n`;
      } else if (isLast) {
        text = `[SECTION: ${section}]\n[EMOTION: inspirational]\n[PACE: medium]\n` +
          `So there you have it — the complete breakdown of ${keyword}. ` +
          `If you implement just ONE thing from this video today, let it be the strategy from section two. ` +
          `Hit that like button if this helped, drop your biggest takeaway in the comments, ` +
          `and subscribe so you don't miss the follow-up video where I go even deeper. ` +
          `[BROLL: thumbs up animation] See you in the next one.\n`;
      } else {
        text = `[SECTION: ${section}]\n[EMOTION: curious]\n[PACE: medium]\n` +
          `Now let's talk about ${section.replace(/_/g, ' ')} when it comes to ${keyword}. ` +
          `[BROLL: relevant footage of ${keyword}] ` +
          `This is where most people get it wrong. Here's the framework that actually works — ` +
          `and once you understand this, everything clicks into place. ` +
          `[HOOK: The next section reveals the part nobody talks about]\n`;
      }

      return text;
    });

    return sections.join('\n\n');
  }
}
