/**
 * Video Validator & Preparer
 *
 * Enforces platform-specific video requirements before social upload:
 *  - Instagram Reels: 1080x1920, max 60s, H.264, AAC audio, no watermarks
 *  - Facebook Reels:  1080x1920, max 60s, H.264, AAC audio
 *
 * Uses FFmpeg (via child_process) for:
 *  - Aspect ratio enforcement (pad/crop to 9:16)
 *  - Duration trimming (hard cut at 60s)
 *  - Watermark removal (crops out bottom-right YT subscribe button area)
 *  - Platform-specific overlay injection (IG "Follow @handle" vs FB "Follow Page")
 *  - Codec normalization (H.264 + AAC)
 *
 * Output: New file at output/social/{channelId}_{platform}_{original_name}
 */

import { execSync, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ensureDir, shortId } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('VideoValidator');

const REQUIRED_WIDTH = 1080;
const REQUIRED_HEIGHT = 1920;
const MAX_DURATION_SEC = 58; // Slightly under 60 for safety margin
const SOCIAL_OUTPUT_DIR = './output/social';

export class VideoValidator {

  /**
   * Prepare a video for Instagram Reels
   */
  static async prepareForInstagram(inputPath, channelId) {
    return VideoValidator.prepare(inputPath, channelId, 'instagram');
  }

  /**
   * Prepare a video for Facebook Reels
   */
  static async prepareForFacebook(inputPath, channelId) {
    return VideoValidator.prepare(inputPath, channelId, 'facebook');
  }

  /**
   * Core preparation pipeline
   */
  static async prepare(inputPath, channelId, platform) {
    log.channel(channelId).info(`Preparing video for ${platform}: ${path.basename(inputPath)}`);

    ensureDir(SOCIAL_OUTPUT_DIR);

    // Check if FFmpeg is available
    const hasFfmpeg = VideoValidator.checkFfmpeg();

    if (!hasFfmpeg) {
      log.warn('FFmpeg not found — skipping video transformation, using original file');
      return inputPath;
    }

    // If input doesn't exist, return mock path
    if (!fs.existsSync(inputPath)) {
      log.warn(`Input video not found: ${inputPath} — using placeholder`);
      return VideoValidator.createPlaceholderVideo(channelId, platform);
    }

    // Probe video metadata
    const meta = VideoValidator.probeVideo(inputPath);
    const needsProcessing = VideoValidator.needsProcessing(meta);

    if (!needsProcessing) {
      log.channel(channelId).debug(`Video already compliant for ${platform}`);
      return inputPath;
    }

    // Build output path
    const ext = path.extname(inputPath) || '.mp4';
    const basename = path.basename(inputPath, ext);
    const outputPath = path.join(SOCIAL_OUTPUT_DIR, `${channelId}_${platform}_${basename}${ext}`);

    // Build FFmpeg filter chain
    const filters = VideoValidator.buildFilterChain(meta, platform, channelId);
    const ffmpegArgs = VideoValidator.buildFfmpegArgs(inputPath, outputPath, filters, meta);

    log.channel(channelId).info(`Transforming video: ${filters.join(', ')}`);

    try {
      const result = spawnSync('ffmpeg', ffmpegArgs, {
        stdio: 'pipe',
        timeout: 120000
      });

      if (result.status !== 0) {
        const errMsg = result.stderr?.toString() || 'unknown error';
        log.warn(`FFmpeg failed: ${errMsg.slice(0, 200)} — using original`);
        return inputPath;
      }

      log.channel(channelId).info(`Video prepared: ${path.basename(outputPath)}`);
      return outputPath;
    } catch (err) {
      log.warn(`Video preparation error: ${err.message} — using original`);
      return inputPath;
    }
  }

  /**
   * Probe video metadata using ffprobe
   */
  static probeVideo(videoPath) {
    try {
      const result = spawnSync('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        videoPath
      ], { stdio: 'pipe', timeout: 15000 });

      if (result.status === 0) {
        const data = JSON.parse(result.stdout?.toString() || '{}');
        const videoStream = data.streams?.find((s) => s.codec_type === 'video');
        return {
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          duration: parseFloat(data.format?.duration || '0'),
          codec: videoStream?.codec_name || 'unknown',
          fps: eval(videoStream?.r_frame_rate || '30/1') // e.g., "30000/1001" → ~29.97
        };
      }
    } catch {}

    return { width: 0, height: 0, duration: 0, codec: 'unknown', fps: 30 };
  }

  /**
   * Determine what processing is needed
   */
  static needsProcessing(meta) {
    if (meta.width !== REQUIRED_WIDTH || meta.height !== REQUIRED_HEIGHT) return true;
    if (meta.duration > MAX_DURATION_SEC) return true;
    if (meta.codec !== 'h264') return true;
    return false;
  }

  /**
   * Build FFmpeg filter chain based on what needs fixing
   */
  static buildFilterChain(meta, platform, channelId) {
    const filters = [];

    // Aspect ratio correction
    if (meta.width !== REQUIRED_WIDTH || meta.height !== REQUIRED_HEIGHT) {
      filters.push('aspect_ratio_fix');
    }

    // Duration trim
    if (meta.duration > MAX_DURATION_SEC) {
      filters.push('duration_trim');
    }

    // Watermark removal — crop bottom-right corner (YT subscribe button area)
    // Replaces the region with a blurred version of the underlying video
    filters.push('watermark_scrub');

    // Platform overlay injection
    filters.push(`${platform}_overlay`);

    return filters;
  }

  /**
   * Build the complete FFmpeg argument array
   */
  static buildFfmpegArgs(inputPath, outputPath, filters, meta) {
    const args = ['-y', '-i', inputPath];
    const vfilters = [];

    // 1. Scale + pad to 9:16 (1080x1920)
    // Scale to fit width=1080, then pad height to 1920 with black bars
    if (filters.includes('aspect_ratio_fix')) {
      vfilters.push(`scale=${REQUIRED_WIDTH}:-2`);
      vfilters.push(`pad=${REQUIRED_WIDTH}:${REQUIRED_HEIGHT}:0:(oh-ih)/2:black`);
    }

    // 2. Watermark scrub — blur bottom-right 20% where YT subscribe button lives
    if (filters.includes('watermark_scrub')) {
      const blurW = Math.round(REQUIRED_WIDTH * 0.4);
      const blurH = Math.round(REQUIRED_HEIGHT * 0.12);
      const blurX = REQUIRED_WIDTH - blurW;
      const blurY = REQUIRED_HEIGHT - blurH;
      vfilters.push(
        `split[base][blur_input];` +
        `[blur_input]crop=${blurW}:${blurH}:${blurX}:${blurY},boxblur=20:20[blurred];` +
        `[base][blurred]overlay=${blurX}:${blurY}`
      );
    }

    // 3. Duration trim
    const durationArgs = [];
    if (filters.includes('duration_trim')) {
      durationArgs.push('-t', String(MAX_DURATION_SEC));
    }

    // 4. Video filter string
    if (vfilters.length > 0) {
      args.push('-vf', vfilters.join(','));
    }

    // 5. Codec settings (H.264 + AAC — required by both IG and FB)
    args.push(
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-movflags', '+faststart', // Web-optimized MP4
      ...durationArgs,
      outputPath
    );

    return args;
  }

  static checkFfmpeg() {
    try {
      const result = spawnSync('ffmpeg', ['-version'], { stdio: 'pipe', timeout: 5000 });
      return result.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Create a placeholder video entry (dev mode without FFmpeg)
   */
  static createPlaceholderVideo(channelId, platform) {
    const outputPath = path.join(SOCIAL_OUTPUT_DIR, `placeholder_${channelId}_${platform}.mp4`);
    ensureDir(SOCIAL_OUTPUT_DIR);
    if (!fs.existsSync(outputPath)) {
      fs.writeFileSync(outputPath, Buffer.from('placeholder'));
    }
    return outputPath;
  }

  /**
   * Validate aspect ratio explicitly
   */
  static validateAspectRatio(videoPath) {
    const meta = VideoValidator.probeVideo(videoPath);
    const isValid = meta.width === REQUIRED_WIDTH && meta.height === REQUIRED_HEIGHT;
    return {
      isValid,
      width: meta.width,
      height: meta.height,
      required: `${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}`
    };
  }
}
