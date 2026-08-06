/**
 * Facebook Reels Upload Worker
 * Phase 13 — Cross-Platform Syndication
 *
 * Uploads 9:16 vertical MP4s to Facebook Page Reels via Graph API v19.0.
 * Uses the POST /v19.0/{page-id}/videos endpoint with `reels` content type.
 *
 * White-hat rules enforced:
 *  - 15-minute stagger delay after Instagram post (anti-spam)
 *  - Platform-specific IG overlay replaced with FB "Follow Page" overlay
 *  - 60s max, but kept at 30s for optimal FB algorithm treatment
 *  - Unique description (not identical copy of IG caption)
 *  - Content category mapping per niche
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { retry, sleep, ensureDir } from '../../utils/helpers.js';
import { VideoValidator } from '../services/video-validator.js';
import { CaptionGenerator } from '../services/caption-generator.js';
import { TokenResolver } from '../services/token-resolver.js';
import logger from '../../utils/logger.js';

const log = logger.layer('FacebookWorker');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';
const FB_STAGGER_DELAY_MS = 15 * 60 * 1000; // 15 minutes after IG

// Facebook content category map per niche
const FB_CONTENT_CATEGORIES = {
  technology:   'SCIENCE_AND_TECH',
  finance:      'BUSINESS',
  health:       'FITNESS_AND_WELLNESS',
  gaming:       'GAMING',
  cooking:      'FOOD_AND_HEALTH',
  'true-crime': 'DRAMA',
  fitness:      'FITNESS_AND_WELLNESS',
  education:    'EDUCATION',
  travel:       'TRAVEL_AND_ADVENTURE',
  default:      'FILM_AND_ANIMATION'
};

export class FacebookWorker {

  /**
   * Main entry point — upload a video to Facebook Reels
   */
  static async upload(jobData) {
    const { videoPath, title, niche, channelId, keyword, skipStagger } = jobData;

    log.channel(channelId).info(`FB upload starting: "${title}"`);

    // 1. Stagger delay — always post to FB 15 min after IG to avoid spam flags
    if (!skipStagger) {
      log.channel(channelId).info('Waiting 15 minutes before FB post (anti-spam stagger)...');
      await sleep(FB_STAGGER_DELAY_MS);
    }

    // 2. Resolve credentials
    const tokens = TokenResolver.getFacebookTokens(channelId);
    if (!tokens.accessToken || !tokens.pageId) {
      throw new Error(`Channel ${channelId}: Facebook credentials not configured`);
    }

    // 3. Validate + prepare video (may differ from IG version — different overlay)
    const validatedPath = await VideoValidator.prepareForFacebook(videoPath, channelId);

    // 4. Generate FB-optimized caption (less hashtag-heavy than IG)
    const description = CaptionGenerator.forFacebook(title, niche, keyword);
    const category = FB_CONTENT_CATEGORIES[niche?.category || niche] || FB_CONTENT_CATEGORIES.default;

    // 5. Get public URL
    const videoUrl = FacebookWorker.getPublicVideoUrl(validatedPath);

    // 6. Upload via Graph API
    log.channel(channelId).info('Uploading to Facebook Reels...');
    const videoId = await FacebookWorker.uploadToPage(
      tokens.pageId,
      tokens.accessToken,
      videoUrl,
      title,
      description,
      category
    );

    log.channel(channelId).info(`✅ Facebook published: video_id=${videoId}`);

    // 7. Save record
    FacebookWorker.saveRecord(channelId, {
      videoId,
      title,
      keyword,
      description,
      category,
      videoPath: validatedPath,
      publishedAt: new Date().toISOString(),
      platform: 'facebook'
    });

    return { videoId, platform: 'facebook', channelId };
  }

  /**
   * POST /v19.0/{page-id}/videos
   * Uploads as a Facebook Reel
   */
  static async uploadToPage(pageId, accessToken, fileUrl, title, description, category) {
    const response = await retry(() =>
      axios.post(`${GRAPH_API_BASE}/${pageId}/videos`, null, {
        params: {
          title,
          description,
          file_url: fileUrl,
          content_category: category,
          content_tags: '[]',
          published: 'true',
          access_token: accessToken
        },
        timeout: 60000
      })
    , 3, 5000);

    if (!response.data?.id) {
      throw new Error(`FB video upload failed: ${JSON.stringify(response.data)}`);
    }

    return response.data.id;
  }

  /**
   * Upload via multipart form (for files served locally without public URL)
   */
  static async uploadMultipart(pageId, accessToken, videoPath, title, description, category) {
    const form = new FormData();
    form.append('source', fs.createReadStream(videoPath));
    form.append('title', title);
    form.append('description', description);
    form.append('content_category', category);
    form.append('published', 'true');
    form.append('access_token', accessToken);

    const response = await retry(() =>
      axios.post(`${GRAPH_API_BASE}/${pageId}/videos`, form, {
        headers: form.getHeaders(),
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
    , 3, 5000);

    return response.data.id;
  }

  static getPublicVideoUrl(videoPath) {
    const staticBase = process.env.STATIC_SERVER_URL || `http://localhost:${process.env.STATIC_PORT || 4001}`;
    const relativePath = videoPath.replace(/^.*[\/\\]output[\/\\]/, '');
    return `${staticBase}/output/${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * Get Facebook page insights for a video
   */
  static async getVideoInsights(pageId, accessToken, videoId) {
    try {
      const response = await retry(() =>
        axios.get(`${GRAPH_API_BASE}/${videoId}/video_insights`, {
          params: {
            metric: 'total_video_views,total_video_impressions,total_video_reactions_by_type_total',
            access_token: accessToken
          },
          timeout: 10000
        })
      );
      return response.data?.data || [];
    } catch (err) {
      log.warn(`FB insights fetch failed for ${videoId}: ${err.message}`);
      return [];
    }
  }

  static saveRecord(channelId, data) {
    ensureDir('./data/social');
    const filePath = `./data/social/facebook_${channelId}.json`;
    let existing = [];
    try {
      const raw = require('fs').readFileSync(filePath, 'utf-8');
      existing = JSON.parse(raw).records || [];
    } catch {}
    existing.push(data);
    require('fs').writeFileSync(filePath, JSON.stringify({ records: existing.slice(-50) }, null, 2));
  }
}
