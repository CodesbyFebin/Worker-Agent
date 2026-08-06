/**
 * TTS Adapter — Emotion-Adaptive Text-to-Speech
 *
 * Converts script segments to audio using ElevenLabs API.
 * Key features:
 *  - Per-segment emotion settings (stability, style, similarity_boost)
 *  - Automatic pace adjustment based on PACE markers
 *  - Voice selection based on niche persona (gender, energy)
 *  - Fallback to browser TTS or mock for dev environments
 *  - Silence padding between segments for natural speech rhythm
 *  - Audio file management and manifest generation
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { retry, sleep, ensureDir, shortId } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('TTSAdapter');
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Voice library — mapped by persona type
const VOICE_PROFILES = {
  male_high_energy:   { voiceId: 'VR6AewLTigWG4xSOukaG', name: 'Arnold' },
  male_calm:          { voiceId: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
  male_cinematic:     { voiceId: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  male_authoritative: { voiceId: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  female_energetic:   { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  female_calm:        { voiceId: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy' },
  female_storyteller: { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
  neutral_professional: { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' }
};

export class TTSAdapter {

  /**
   * Generate audio for all content versions (Pillar, Snippet, Short)
   */
  static async generateAll(contentVersions, niche) {
    const results = {};

    const voiceProfile = TTSAdapter.selectVoice(niche);
    log.info(`Using voice: ${voiceProfile.name} for niche ${niche.id}`);

    for (const [versionType, content] of Object.entries(contentVersions)) {
      if (!content || !content.segments) continue;

      log.info(`Generating TTS for ${versionType} version (${content.segments.length} segments)`);

      const audioFiles = await TTSAdapter.generateForScript(
        content,
        niche,
        voiceProfile,
        versionType
      );

      results[versionType] = {
        voiceProfile,
        audioFiles,
        manifest: TTSAdapter.buildManifest(audioFiles, content),
        totalDurationSeconds: audioFiles.reduce((s, f) => s + (f.durationSeconds || 0), 0)
      };
    }

    return results;
  }

  /**
   * Generate audio files for a single script version
   */
  static async generateForScript(script, niche, voiceProfile, versionLabel) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const outputDir = path.join(OUTPUT_DIR, 'audio', script.id || shortId(), versionLabel);
    ensureDir(outputDir);

    const audioFiles = [];

    for (let i = 0; i < script.segments.length; i++) {
      const segment = script.segments[i];

      // Skip empty segments and pure B-roll cues
      if (!segment.text || segment.text.trim().length < 3) continue;

      const filename = `seg_${String(i).padStart(3, '0')}_${segment.section}.mp3`;
      const outputPath = path.join(outputDir, filename);

      let fileInfo;

      if (apiKey) {
        fileInfo = await TTSAdapter.generateSegmentAudio(
          segment,
          voiceProfile,
          outputPath,
          apiKey
        );
      } else {
        // Dev mode — create silent placeholder
        fileInfo = TTSAdapter.createPlaceholderAudio(segment, outputPath);
      }

      audioFiles.push({
        index: i,
        filename,
        path: outputPath,
        section: segment.section,
        emotion: segment.emotion,
        pace: segment.pace,
        isRetentionHook: segment.isRetentionHook || false,
        brollCues: segment.brollCues || [],
        durationSeconds: fileInfo.durationSeconds,
        wordCount: segment.wordCount
      });

      // Rate limiting — ElevenLabs free tier: 2 req/sec
      if (apiKey) await sleep(600);
    }

    return audioFiles;
  }

  /**
   * Generate audio for a single segment via ElevenLabs
   */
  static async generateSegmentAudio(segment, voiceProfile, outputPath, apiKey) {
    const tts = segment.ttsSettings || { stability: 0.5, similarity_boost: 0.75, style: 0.5 };

    // Apply pace modifier to text (ElevenLabs uses SSML-like breaks)
    const processedText = TTSAdapter.applyPaceModifiers(segment.text, segment.pace);

    try {
      const response = await retry(() =>
        axios.post(
          `${ELEVENLABS_BASE}/text-to-speech/${voiceProfile.voiceId}`,
          {
            text: processedText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: tts.stability,
              similarity_boost: tts.similarity_boost,
              style: tts.style,
              use_speaker_boost: true
            }
          },
          {
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        )
      , 3, 1500);

      fs.writeFileSync(outputPath, Buffer.from(response.data));

      const estimatedDuration = Math.round((segment.wordCount / 145) * 60);
      log.debug(`Audio generated: ${path.basename(outputPath)} (~${estimatedDuration}s)`);

      return { durationSeconds: estimatedDuration };
    } catch (err) {
      log.error(`TTS generation failed for segment: ${err.message}`);
      return TTSAdapter.createPlaceholderAudio(segment, outputPath);
    }
  }

  /**
   * Apply pace modifiers to text for TTS speed control
   * ElevenLabs supports natural pacing through punctuation
   */
  static applyPaceModifiers(text, pace) {
    if (!pace) return text;

    switch (pace) {
      case 'fast':
        // Remove extra pauses, compress punctuation spacing
        return text.replace(/\.\s+/g, '. ').replace(/,\s+/g, ', ');

      case 'slow':
        // Add strategic pauses for dramatic effect
        return text
          .replace(/\. /g, '... ')
          .replace(/, /g, ',  ')
          .replace(/—/g, ' — ');

      case 'medium':
      default:
        return text;
    }
  }

  /**
   * Select the optimal voice profile based on niche persona settings
   */
  static selectVoice(niche) {
    const overrideVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    if (overrideVoiceId) {
      return { voiceId: overrideVoiceId, name: 'Custom' };
    }

    const gender = niche.voiceGender || 'neutral';
    const energy = niche.energyLevel || 'medium';
    const tone = niche.tone || 'conversational';

    if (gender === 'male') {
      if (tone === 'cinematic' || tone === 'investigative') return VOICE_PROFILES.male_cinematic;
      if (energy === 'high') return VOICE_PROFILES.male_high_energy;
      if (energy === 'low') return VOICE_PROFILES.male_calm;
      return VOICE_PROFILES.male_authoritative;
    }

    if (gender === 'female') {
      if (energy === 'high') return VOICE_PROFILES.female_energetic;
      if (tone === 'cinematic') return VOICE_PROFILES.female_storyteller;
      return VOICE_PROFILES.female_calm;
    }

    return VOICE_PROFILES.neutral_professional;
  }

  /**
   * Create a placeholder audio file for dev/testing
   */
  static createPlaceholderAudio(segment, outputPath) {
    // Write a minimal valid MP3 header as placeholder
    const mp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
    fs.writeFileSync(outputPath, mp3Header);

    const estimatedDuration = Math.round((segment.wordCount / 145) * 60);
    log.debug(`Placeholder audio: ${path.basename(outputPath)} (~${estimatedDuration}s)`);
    return { durationSeconds: estimatedDuration, isPlaceholder: true };
  }

  /**
   * Build an audio manifest for the video editor
   * Maps each audio file to timestamps and B-Roll cues
   */
  static buildManifest(audioFiles, script) {
    let currentTimestamp = 0;
    const entries = [];

    for (const file of audioFiles) {
      entries.push({
        ...file,
        startTime: currentTimestamp,
        endTime: currentTimestamp + file.durationSeconds
      });
      currentTimestamp += file.durationSeconds + 0.3; // 300ms gap between segments
    }

    return {
      totalDuration: currentTimestamp,
      segmentCount: entries.length,
      entries,
      scriptId: script.id
    };
  }
}
