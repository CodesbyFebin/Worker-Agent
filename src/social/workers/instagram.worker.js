/**
 * Instagram Reels Upload Worker
 * Phase 13 — Cross-Platform Syndication
 *
 * Uploads 9:16 vertical MP4s to Instagram Reels via Facebook Graph API v19.0.
 * Uses the two-step container → publish protocol required by Meta.
 *
 * Flow:
 *  1. Validate video (aspect ratio, duration, codec)
 *  2. Serve the local file via CC-OS static server
 *  3. POST /media (creates container, returns creation_id)
 *  4. Poll container status until FINISHED
 *  5. POST /media_publish (goes live)
 *  6. Return instagram media ID
 *
 * White-hat rules enforced:
 *  - Watermark scrub (removes YT subscribe overlay before upload)
 *  - Aspect ratio enforcement (must be exactly 1080x1920)
 *  - 60s max duration (Meta hard limit for Reels)
 *  - Platform-specific caption with IG hashtags
 *  - 0 TikTok watermark tolerance
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { retry, sleep, ensureDir } from '../../utils/helpers.js';
import { VideoValidator } from '../services/video-validator.js';
import { CaptionGenerator } from '../services/caption-generator.js';
import { TokenResolver } from '../services/token-resolver.js';
import logger from '../../utils/logger.js';

const log = logger.layer('InstagramWorker');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';
const MAX_REELS_DURATION_SEC = 60;
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 5000;

export class InstagramWorker {

  /**
   * Main entry point — upload a video to Instagram Reels
   */
  static async upload(jobData) {
    const { videoPath, title, niche, channelId, organizationId, keyword } = jobData;

    log.channel(channelId).info(`IG upload starting: "${title}"`);

    // 1. Resolve credentials
    const tokens = TokenResolver.getInstagramTokens(channelId);
    if (!tokens.accessToken || !tokens.businessId) {
      throw new Error(`Channel ${channelId}: Instagram credentials not configured`);
    }

    // 2. Validate + prepare video
    const validatedPath = await VideoValidator.prepareForInstagram(videoPath, channelId);

    // 3. Generate IG-optimized caption
    const caption = CaptionGenerator.forInstagram(title, niche, keyword);

    // 4. Get public URL for the video file
    const publicUrl = InstagramWorker.getPublicVideoUrl(validatedPath);

    // 5. Create media container
    log.channel(channelId).info('Creating IG media container...');
    const containerId = await InstagramWorker.createMediaContainer(
      tokens.businessId,
      tokens.accessToken,
      publicUrl,
      caption
    );

    // 6. Poll until container is ready
    log.channel(channelId).info(`Polling container ${containerId}...`);
    await InstagramWorker.waitForContainer(tokens.businessId, tokens.accessToken, containerId, channelId);

    // 7. Publish
    log.channel(channelId).info('Publishing to Instagram Reels...');
    const mediaId = await InstagramWorker.publishContainer(
      tokens.businessId,
      tokens.accessToken,
      containerId
    );

    log.channel(channelId).info(`✅ Instagram published: media_id=${mediaId}`);

    // 8. Save record
    InstagramWorker.saveRecord(channelId, {
      mediaId,
      containerId,
      title,
      keyword,
      caption,
      videoPath: validatedPath,
      publishedAt: new Date().toISOString(),
      platform: 'instagram'
    });

    return { mediaId, platform: 'instagram', channelId };
  }

  /**
   * Step 1 — POST to /{ig-user-id}/media
   * Creates the Reels container and returns creation_id
   */
  static async createMediaContainer(igUserId, accessToken, videoUrl, caption) {
    const response = await retry(() =>
      axios.post(`${GRAPH_API_BASE}/${igUserId}/media`, null, {
        params: {
          media_type: 'REELS',
          video_url: videoUrl,
          caption: caption,
          share_to_feed: 'true',
          access_token: accessToken
        },
        timeout: 30000
      })
    , 3, 3000);

    if (!response.data?.id) {
      throw new Error(`IG container creation failed: ${JSON.stringify(response.data)}`);
    }

    return response.data.id;
  }

  /**
   * Poll container status until it's FINISHED or ERROR
   */
  static async waitForContainer(igUserId, accessToken, containerId, channelId) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const response = await retry(() =>
        axios.get(`${GRAPH_API_BASE}/${containerId}`, {
          params: {
            fields: 'status_code,status',
            access_token: accessToken
          },
          timeout: 10000
        })
      );

      const status = response.data?.status_code;
      log.channel(channelId).debug(`Container status: ${status} (attempt ${attempt + 1})`);

      if (status === 'FINISHED') return;
      if (status === 'ERROR') {
        throw new Error(`IG container processing failed: ${response.data?.status}`);
      }
      if (status === 'EXPIRED') {
        throw new Error('IG container expired — video took too long to process');
      }
    }

    throw new Error(`IG container polling timed out after ${MAX_POLL_ATTEMPTS} attempts`);
  }

  /**
   * Step 2 — POST to /{ig-user-id}/media_publish
   * Goes live on Instagram
   */
  static async publishContainer(igUserId, accessToken, containerId) {
    const response = await retry(() =>
      axios.post(`${GRAPH_API_BASE}/${igUserId}/media_publish`, null, {
        params: {
          creation_id: containerId,
          access_token: accessToken
        },
        timeout: 20000
      })
    , 3, 2000);

    if (!response.data?.id) {
      throw new Error(`IG publish failed: ${JSON.stringify(response.data)}`);
    }

    return response.data.id;
  }

  /**
   * Build a local public URL for the video file
   * The static server serves ./output/ at http://localhost:4000/output/
   */
  static getPublicVideoUrl(videoPath) {
    const staticBase = process.env.STATIC_SERVER_URL || `http://localhost:${process.env.STATIC_PORT || 4001}`;
    const relativePath = videoPath.replace(/^.*[\/\\]output[\/\\]/, '');
    return `${staticBase}/output/${relativePath.replace(/\\/g, '/')}`;
  }

  static saveRecord(channelId, data) {
    const dir = './data/social';
    ensureDir(dir);
    const records = InstagramWorker.loadRecords(channelId);
    records.push(data);
    const { writeJSON } = require('../../utils/helpers.js');
    writeJSON(`${dir}/instagram_${channelId}.json`, { records: records.slice(-50) });
  }

  static loadRecords(channelId) {
    const { readJSON } = require('../../utils/helpers.js');
    const data = readJSON(`./data/social/instagram_${channelId}.json`);
    return data?.records || [];
  }
}
