/**
 * Human Noise Injector
 *
 * The "White-Hack" technique that defeats AI content detection.
 *
 * Problem: AI-generated scripts are too syntactically perfect.
 *  - Zero filler words
 *  - Perfect grammar throughout
 *  - No personal anecdotes
 *  - No regional language variations
 *  - Uniform sentence rhythm
 *
 * Solution: Inject controlled "human imperfections" that are:
 *  - Characteristic of real human speech
 *  - Stylistically consistent per channel persona
 *  - Not detectable as injected (woven naturally)
 *  - Not reducing quality for the viewer
 *
 * Injection types:
 *  1. Filler words (casual, persona-consistent)
 *  2. Personal anecdotes from Memory Bank
 *  3. Self-correction phrases
 *  4. Regional/cultural slang (niche-appropriate)
 *  5. Minor grammatical quirks (contractions, ellipsis)
 *  6. Sentence rhythm variation (short + long mix)
 *  7. Rhetorical questions
 *  8. Opinion markers ("I think", "in my experience")
 */

import OpenAI from 'openai';
import { retry, pickRandom, shuffle } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('HumanNoiseInjector');

// ─── Human Speech Pattern Libraries ─────────────────────────────────────────

const FILLER_WORDS = {
  low: ['actually', 'basically', 'essentially', 'really', 'honestly'],
  medium: ['look', 'right', 'you know', 'I mean', 'basically', 'literally', 'honestly', 'actually', 'here\'s the thing'],
  high: ['okay so', 'like', 'you know what I mean', 'and honestly', 'I\'ll be real with you', 'here\'s the crazy part', 'no seriously']
};

const SELF_CORRECTIONS = [
  '— wait, let me rephrase that —',
  '— actually, a better way to put it is —',
  '— or more accurately —',
  ', and I should clarify —',
  ' — and I want to be precise here —'
];

const PERSONAL_ANECDOTE_STARTERS = [
  'When I first started with this, I',
  'I remember the first time I tried this — I',
  'This actually happened to me last year —',
  'A friend of mine who does this professionally told me that',
  'I tested this myself for three weeks and',
  'You know what\'s funny? I',
  'This is something I personally struggled with — I'
];

const RHETORICAL_QUESTIONS = [
  'Does that make sense?',
  'Right?',
  'You see what I mean?',
  'Think about that for a second.',
  'Sound familiar?',
  'Here\'s what I want you to ask yourself:',
  'Why does this matter? Because',
  'So what does this mean for you?'
];

const OPINION_MARKERS = [
  'In my experience,',
  'Personally, I think',
  'My honest take on this is',
  'And I\'ll be transparent here —',
  'From what I\'ve seen,',
  'I\'ve come to believe that',
  'Look, this is just my perspective, but'
];

// Tone-appropriate contractions (make formal → conversational)
const FORMALITY_CONTRACTIONS = {
  'I am ': "I'm ",
  'I will ': "I'll ",
  'I have ': "I've ",
  'I would ': "I'd ",
  'you are ': "you're ",
  'you will ': "you'll ",
  'you have ': "you've ",
  'it is ': "it's ",
  'it will ': "it'll ",
  'they are ': "they're ",
  'they will ': "they'll ",
  'we are ': "we're ",
  'we will ': "we'll ",
  'do not ': "don't ",
  'does not ': "doesn't ",
  'did not ': "didn't ",
  'can not ': "can't ",
  'cannot ': "can't ",
  'will not ': "won't ",
  'should not ': "shouldn't ",
  'would not ': "wouldn't ",
  'could not ': "couldn't ",
  'is not ': "isn't ",
  'are not ': "aren't ",
  'has not ': "hasn't ",
  'have not ': "haven't ",
  'that is ': "that's ",
  'there is ': "there's ",
  'here is ': "here's ",
  'what is ': "what's ",
};

export class HumanNoiseInjector {

  /**
   * Inject human noise into a script based on niche persona settings
   */
  static async inject(script, niche) {
    const noiseLevel = process.env.HUMAN_NOISE_LEVEL || niche.humanNoiseLevel || 'medium';
    log.info(`Injecting human noise [${noiseLevel}] into script ${script.id}`);

    const persona = niche.channelPersona || {};
    const memoryBank = HumanNoiseInjector.buildMemoryBank(persona, niche);

    const enrichedSegments = [];
    let anecdoteInserted = 0;

    for (let i = 0; i < script.segments.length; i++) {
      const segment = script.segments[i];

      // Skip retention hooks and transitions — don't add noise there
      if (segment.isRetentionHook || segment.isTransition) {
        enrichedSegments.push(segment);
        continue;
      }

      let text = segment.text;

      // Step 1: Apply contractions
      text = HumanNoiseInjector.applyContractions(text);

      // Step 2: Inject fillers at sentence boundaries
      text = HumanNoiseInjector.injectFillers(text, noiseLevel, persona);

      // Step 3: Add self-correction once per script (middle sections only)
      if (noiseLevel !== 'low' && i > 1 && i < script.segments.length - 2 && Math.random() < 0.2) {
        text = HumanNoiseInjector.insertSelfCorrection(text);
      }

      // Step 4: Insert personal anecdote (once per script, in a middle section)
      if (anecdoteInserted === 0 && i > 0 && i < script.segments.length - 1 && Math.random() < 0.35) {
        const anecdote = HumanNoiseInjector.generateAnecdote(memoryBank, niche);
        text = text + ' ' + anecdote;
        anecdoteInserted++;
      }

      // Step 5: Add rhetorical question (once per 3-4 sections)
      if (i > 0 && i % 3 === 0 && noiseLevel !== 'low') {
        text = HumanNoiseInjector.addRhetoricalQuestion(text);
      }

      // Step 6: Add opinion marker to one key claim section
      if (noiseLevel === 'high' && i === Math.floor(script.segments.length * 0.4)) {
        text = HumanNoiseInjector.addOpinionMarker(text, persona);
      }

      // Step 7: Vary sentence rhythm (break up identical short/long patterns)
      text = HumanNoiseInjector.varySentenceRhythm(text);

      // Step 8: Add persona catchphrase (naturally, once)
      if (i === 1 && persona.catchphrases?.length > 0) {
        const phrase = pickRandom(persona.catchphrases);
        text = `${text} And ${phrase} — that\'s something I always come back to.`;
      }

      enrichedSegments.push({ ...segment, text });
    }

    // Calculate human score using heuristics
    const humanScore = HumanNoiseInjector.calculateHumanScore(enrichedSegments, noiseLevel);

    log.info(`Human noise injection complete. Human score: ${(humanScore * 100).toFixed(0)}%`);

    return {
      ...script,
      segments: enrichedSegments,
      noiseInjectionLevel: noiseLevel,
      humanScore,
      fullText: enrichedSegments.map((s) => s.text).join('\n\n')
    };
  }

  /**
   * Apply contractions to reduce formal AI-writing patterns
   */
  static applyContractions(text) {
    let result = text;
    for (const [formal, contraction] of Object.entries(FORMALITY_CONTRACTIONS)) {
      const regex = new RegExp(formal, 'gi');
      result = result.replace(regex, contraction);
    }
    return result;
  }

  /**
   * Inject filler words at natural sentence boundaries
   */
  static injectFillers(text, noiseLevel, persona) {
    const fillers = FILLER_WORDS[noiseLevel] || FILLER_WORDS.medium;
    const sentences = text.split(/(?<=[.!?])\s+/);

    if (sentences.length < 3) return text;

    // Inject into ~20-30% of sentence transitions
    const injectRate = noiseLevel === 'high' ? 0.3 : noiseLevel === 'medium' ? 0.2 : 0.1;

    return sentences.map((sentence, i) => {
      if (i === 0 || Math.random() > injectRate) return sentence;

      const filler = pickRandom(fillers);
      const firstChar = sentence.charAt(0);

      // Only inject if sentence starts with a word (not a marker)
      if (firstChar === '[' || firstChar === '{') return sentence;

      // Inject naturally at start of sentence
      return `${filler.charAt(0).toUpperCase() + filler.slice(1)}, ${sentence.charAt(0).toLowerCase() + sentence.slice(1)}`;
    }).join(' ');
  }

  /**
   * Insert a self-correction mid-sentence
   */
  static insertSelfCorrection(text) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length < 2) return text;

    const insertAt = Math.floor(sentences.length / 2);
    const correction = pickRandom(SELF_CORRECTIONS);

    sentences.splice(insertAt, 0, correction);
    return sentences.join(' ');
  }

  /**
   * Generate a contextual personal anecdote from the Memory Bank
   */
  static generateAnecdote(memoryBank, niche) {
    const starter = pickRandom(PERSONAL_ANECDOTE_STARTERS);
    const experience = pickRandom(memoryBank.experiences);
    const outcome = pickRandom(memoryBank.outcomes);

    return `${starter} ${experience}, and ${outcome}.`;
  }

  /**
   * Add a rhetorical question at the end of a text block
   */
  static addRhetoricalQuestion(text) {
    const question = pickRandom(RHETORICAL_QUESTIONS);
    return `${text} ${question}`;
  }

  /**
   * Add an opinion marker to the beginning of a paragraph
   */
  static addOpinionMarker(text, persona) {
    const marker = pickRandom(OPINION_MARKERS);
    return `${marker} ${text.charAt(0).toLowerCase() + text.slice(1)}`;
  }

  /**
   * Vary sentence rhythm by merging or splitting uniformly-sized sentences
   */
  static varySentenceRhythm(text) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length < 4) return text;

    const result = [];
    let i = 0;

    while (i < sentences.length) {
      const current = sentences[i];
      const wordCount = current.split(' ').length;

      // Merge two very short sentences (< 8 words) into one
      if (wordCount < 8 && i + 1 < sentences.length) {
        const next = sentences[i + 1];
        // Use em-dash or comma to join
        const joiners = [' — ', ', and ', ', but ', '; '];
        const joiner = pickRandom(joiners);
        result.push(current.replace(/[.!?]$/, '') + joiner + next.charAt(0).toLowerCase() + next.slice(1));
        i += 2;
        continue;
      }

      result.push(current);
      i++;
    }

    return result.join(' ');
  }

  /**
   * Build a Memory Bank from channel persona for anecdote generation
   */
  static buildMemoryBank(persona, niche) {
    const backstory = persona.backstory || `a content creator in the ${niche.category} space`;

    const experienceTemplates = {
      technology: [
        'tried a dozen different tools before finding the right workflow',
        'spent three months testing this approach on my own projects',
        'watched my productivity double after making this one change',
        'broke my own setup completely before learning what actually works'
      ],
      finance: [
        'made every mistake in the book when I first started investing',
        'lost money before I understood this fundamental principle',
        'tracked every single expense for six months straight',
        'went from paycheck-to-paycheck to actually building wealth'
      ],
      health: [
        'tried every diet and routine over a span of two years',
        'completely burned out before I learned to work with my body',
        'ignored this advice for years and wish I hadn\'t',
        'saw a dramatic shift within the first few weeks of doing this'
      ],
      default: [
        'spent months researching this topic before making a move',
        'made a lot of mistakes in the beginning that I now share to help others',
        'completely changed my approach after learning this the hard way',
        'tested multiple methods before finding what consistently works'
      ]
    };

    const outcomeTemplates = [
      'the results completely surprised me',
      'everything changed after that',
      'I\'ve never looked back since',
      'it became the foundation of everything I do now',
      'it turned out to be the missing piece'
    ];

    const experiences = experienceTemplates[niche.category] || experienceTemplates.default;

    return {
      backstory,
      experiences,
      outcomes: outcomeTemplates
    };
  }

  /**
   * Calculate human-ness score of the injected script (0-1)
   * Higher = more human-like, less likely to be flagged by AI detectors
   */
  static calculateHumanScore(segments, noiseLevel) {
    let totalScore = 0;
    let count = 0;

    for (const seg of segments) {
      if (seg.isRetentionHook || seg.isTransition) continue;
      const text = seg.text;

      let segScore = 0.5; // Baseline

      // Contractions present (strong human signal)
      const contractionCount = (text.match(/\b\w+'[a-z]+\b/gi) || []).length;
      segScore += Math.min(contractionCount * 0.03, 0.15);

      // Sentence length variation
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      if (sentences.length > 1) {
        const lengths = sentences.map((s) => s.split(' ').length);
        const maxLen = Math.max(...lengths);
        const minLen = Math.min(...lengths);
        const variation = (maxLen - minLen) / maxLen;
        segScore += variation * 0.1;
      }

      // Filler words present
      const fillerCount = (text.match(/\b(actually|basically|honestly|really|you know|I mean|look)\b/gi) || []).length;
      segScore += Math.min(fillerCount * 0.04, 0.12);

      // Personal pronouns (I, my, me, we)
      const pronounCount = (text.match(/\b(I|my|me|we|our)\b/gi) || []).length;
      segScore += Math.min(pronounCount * 0.02, 0.08);

      // Questions present
      const questionCount = (text.match(/\?/g) || []).length;
      segScore += Math.min(questionCount * 0.05, 0.1);

      totalScore += Math.min(segScore, 1.0);
      count++;
    }

    const avgScore = count > 0 ? totalScore / count : 0.5;

    // Boost for high noise level
    const levelBonus = noiseLevel === 'high' ? 0.05 : noiseLevel === 'medium' ? 0.02 : 0;
    return Math.min(avgScore + levelBonus, 1.0);
  }
}
