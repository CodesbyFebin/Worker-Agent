/**
 * Metadata Packager — Auto-Transcriber SEO
 *
 * Generates a complete YouTube metadata package for each video:
 *  - 3 title variants (Clickbait / Descriptive / Question-based)
 *  - 2 description versions (Short / Long)
 *  - Keyword-optimized tag array
 *  - Chapters from script sections
 *  - Pinned comment template
 *  - End screen CTA text
 *  - Cards text (mid-video prompts)
 */

import OpenAI from 'openai';
import { retry } from '../../utils/helpers.js';
import { SentimentAnalyzer } from '../layer1-data-brain/sentiment-analyzer.js';
import logger from '../../utils/logger.js';

const log = logger.layer('MetadataPackager');

export class MetadataPackager {

  /**
   * Generate a complete metadata package for a video
   */
  static async package(opportunity, script, niche) {
    log.info(`Packaging metadata for: "${opportunity.keyword}"`);

    const [titles, descriptions, chapters, comments] = await Promise.allSettled([
      MetadataPackager.generateTitles(opportunity, niche),
      MetadataPackager.generateDescriptions(opportunity, script, niche),
      MetadataPackager.generateChapters(script),
      MetadataPackager.generateEngagementCopy(opportunity, niche)
    ]);

    const titleList = titles.status === 'fulfilled' ? titles.value : MetadataPackager.mockTitles(opportunity.keyword);
    const descList = descriptions.status === 'fulfilled' ? descriptions.value : MetadataPackager.mockDescriptions(opportunity.keyword, niche);
    const chapterList = chapters.status === 'fulfilled' ? chapters.value : [];
    const engagementCopy = comments.status === 'fulfilled' ? comments.value : {};

    // Score all titles for CTR potential
    const scoredTitles = titleList.map((title) => ({
      title,
      ...SentimentAnalyzer.analyzeKeyword(title),
      type: MetadataPackager.classifyTitle(title)
    }));
    scoredTitles.sort((a, b) => b.viralityScore - a.viralityScore);

    const pkg = {
      titles: scoredTitles,
      primaryTitle: scoredTitles[0]?.title || opportunity.keyword,
      descriptions: descList,
      primaryDescription: descList.long || descList.short,
      tags: opportunity.videoTags || [],
      hashtags: opportunity.hashtags || [],
      chapters: chapterList,
      engagementCopy,
      pinnedComment: engagementCopy.pinnedComment || '',
      endCardText: engagementCopy.endCardText || '',
      cardTexts: engagementCopy.cardTexts || [],
      microNodes: opportunity.microNodes || [],
      keyword: opportunity.keyword,
      packagedAt: new Date().toISOString()
    };

    log.info(`Metadata packaged: ${scoredTitles.length} title variants, tags: ${pkg.tags.length}`);
    return pkg;
  }

  /**
   * Generate 3 title variants using AI
   * Types: Clickbait | Descriptive | Question-based
   */
  static async generateTitles(opportunity, niche) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return MetadataPackager.mockTitles(opportunity.keyword);

    try {
      const openai = new OpenAI({ apiKey });
      const emotion = opportunity.sentiment?.dominantEmotion || 'curiosity';

      const response = await retry(() =>
        openai.chat.completions.create({
          model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a YouTube title optimization expert. Return ONLY a JSON array of 3 strings.'
            },
            {
              role: 'user',
              content: `Generate 3 YouTube video titles for topic: "${opportunity.keyword}"
Niche: ${niche.category} | Tone: ${niche.tone} | Target emotion: ${emotion}

Generate exactly 3 titles:
1. CLICKBAIT style: provocative, uses power words (SHOCKING, TRUTH, SECRET, etc.), max 60 chars
2. DESCRIPTIVE style: clear, keyword-rich, includes year 2026 if relevant, max 60 chars
3. QUESTION style: starts with "How/Why/What/Is", creates curiosity, max 60 chars

Rules:
- Include the main keyword or close variant in ALL 3 titles
- Use Title Case
- NO clickbait that's misleading — must deliver on promise
- Optimize for CTR and keyword searchability

Return ONLY: ["clickbait title", "descriptive title", "question title"]`
            }
          ],
          temperature: 0.8,
          max_tokens: 300
        })
      );

      const content = response.choices[0].message.content.trim();
      const match = content.match(/\[.*\]/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return parsed.filter((t) => t && t.length > 5);
      }
      return MetadataPackager.mockTitles(opportunity.keyword);
    } catch (err) {
      log.warn(`Title generation failed: ${err.message}`);
      return MetadataPackager.mockTitles(opportunity.keyword);
    }
  }

  /**
   * Generate short and long video descriptions
   */
  static async generateDescriptions(opportunity, script, niche) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return MetadataPackager.mockDescriptions(opportunity.keyword, niche);

    const scriptSummary = script.segments
      .filter((s) => !s.isRetentionHook)
      .slice(0, 5)
      .map((s) => s.text.slice(0, 100))
      .join(' ');

    try {
      const openai = new OpenAI({ apiKey });

      const response = await retry(() =>
        openai.chat.completions.create({
          model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a YouTube SEO expert. Return ONLY valid JSON.'
            },
            {
              role: 'user',
              content: `Write YouTube video descriptions for topic: "${opportunity.keyword}"
Channel: ${niche.channelName} | Category: ${niche.category}
Script summary: "${scriptSummary}"
Tags to include: ${(opportunity.videoTags || []).slice(0, 8).join(', ')}
Hashtags: ${(opportunity.hashtags || []).slice(0, 5).join(' ')}

Return JSON with two keys:
{
  "short": "150 word description — hook + what they'll learn + CTA",
  "long": "400 word description — full SEO-optimized with timestamps placeholder [CHAPTERS], keyword repetition, links section, hashtags at bottom"
}

Include: subscribe CTA, social links placeholder, chapters marker [CHAPTERS]`
            }
          ],
          temperature: 0.65,
          max_tokens: 800
        })
      );

      const content = response.choices[0].message.content.trim();
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (err) {
      log.warn(`Description generation failed: ${err.message}`);
    }

    return MetadataPackager.mockDescriptions(opportunity.keyword, niche);
  }

  /**
   * Generate video chapters from script sections with timestamps
   */
  static generateChapters(script) {
    const chapters = [];
    let currentTime = 0;

    const uniqueSections = [];
    const seenSections = new Set();

    for (const seg of script.segments) {
      if (!seenSections.has(seg.section) && !seg.isRetentionHook) {
        seenSections.add(seg.section);
        uniqueSections.push({ section: seg.section, startTime: currentTime });
      }
      currentTime += seg.estimatedDurationSeconds || 30;
    }

    // Ensure first chapter always starts at 0:00
    uniqueSections[0] && (uniqueSections[0].startTime = 0);

    return uniqueSections.map((s) => ({
      title: MetadataPackager.sectionToChapterTitle(s.section),
      timestamp: MetadataPackager.secondsToTimestamp(s.startTime),
      startSeconds: s.startTime
    }));
  }

  /**
   * Generate engagement copy: pinned comment, end card text, mid-video cards
   */
  static async generateEngagementCopy(opportunity, niche) {
    const keyword = opportunity.keyword;

    return {
      pinnedComment: `🔥 WATCH UNTIL THE END — I reveal the #1 tip about ${keyword} that most people skip past.\n\n👇 Drop your biggest question about ${keyword} in the comments — I reply to everyone in the first 24 hours!\n\n📌 Timestamps are in the description.`,

      endCardText: `Now that you know about ${keyword}, watch this next →`,

      cardTexts: [
        { timing: 0.25, text: `${keyword} — More tips here`, type: 'video_suggestion' },
        { timing: 0.65, text: 'Get the FREE checklist (link below)', type: 'link' },
        { timing: 0.85, text: 'Subscribe for weekly videos', type: 'subscribe' }
      ],

      communityPostTemplate: `Just uploaded: "${keyword}" — my most detailed breakdown yet.\n\nQuick question for you: What's your BIGGEST challenge with ${keyword} right now?\n\nA) Getting started\nB) Staying consistent\nC) Seeing results\nD) Something else (comment below)\n\nLink in bio 👆`,

      shortCTAComment: `Full ${keyword} breakdown in the description! 🔗 Subscribe for more 👆`
    };
  }

  static classifyTitle(title) {
    if (/^(how|why|what|is|can|should|does|will)\b/i.test(title)) return 'question';
    if (/[A-Z]{3,}|!|\?.*\?/.test(title) || /\b(secret|truth|shocking|revealed|exposed)\b/i.test(title)) return 'clickbait';
    return 'descriptive';
  }

  static sectionToChapterTitle(sectionName) {
    return sectionName
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  static secondsToTimestamp(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  static mockTitles(keyword) {
    const short = keyword.split(' ').slice(0, 4).join(' ');
    return [
      `The TRUTH About ${short} Nobody Tells You`,
      `Complete ${short} Guide for 2026 (Step by Step)`,
      `Why Is ${short} So Effective? (Full Breakdown)`
    ];
  }

  static mockDescriptions(keyword, niche) {
    return {
      short: `In this video, I break down everything you need to know about ${keyword}. Whether you're a complete beginner or looking to level up, this guide covers it all.\n\n🔔 Subscribe for more ${niche.category} content!\n\n${(niche.microNodes || []).map((n) => `#${n}`).join(' ')}`,
      long: `In this comprehensive video, I dive deep into ${keyword} and show you exactly what works in 2026.\n\nWhat you'll learn:\n✅ The fundamentals of ${keyword}\n✅ Common mistakes to avoid\n✅ Advanced strategies that actually work\n✅ Real-world examples and case studies\n\n[CHAPTERS]\n\n👇 Resources mentioned:\n• Link 1: [resource]\n• Link 2: [resource]\n\n📱 Follow on social: [links]\n\n🔔 Subscribe: [link]\n\n${(niche.hashtags || [niche.category]).map((h) => `#${h.replace('#', '')}`).join(' ')}`
    };
  }
}
