/**
 * Channel Manager
 *
 * Manages all 10 channel profiles and their operational state.
 * Each channel is a fully isolated identity with:
 *  - Its own niche profile
 *  - Its own upload history and cooldown timer
 *  - Its own performance metrics
 *  - Its own OAuth token
 *  - Its own fingerprint profile (browser, IP, cookies)
 *
 * Channel states:
 *  - idle        : Ready to receive new content
 *  - generating  : Content pipeline is running
 *  - uploading   : Currently uploading to YouTube
 *  - cooldown    : Waiting for minimum upload gap
 *  - paused      : Manually paused by operator
 *  - flagged     : YouTube has flagged the channel — halt & alert
 */

import path from 'path';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import { NicheProfiler } from '../layer1-data-brain/niche-profiler.js';
import logger from '../../utils/logger.js';

const log = logger.layer('ChannelManager');
const DATA_DIR = './data/analytics';
const TOTAL_CHANNELS = parseInt(process.env.TOTAL_CHANNELS || '10', 10);

export class ChannelManager {

  /**
   * Load all channel profiles and their current state
   */
  static async loadAll() {
    const channels = {};

    for (let i = 1; i <= TOTAL_CHANNELS; i++) {
      const channelId = String(i).padStart(2, '0');
      channels[channelId] = await ChannelManager.load(channelId);
    }

    return channels;
  }

  /**
   * Load a single channel's full profile + state
   */
  static async load(channelId) {
    const statePath = path.join(DATA_DIR, `channel_${channelId}_state.json`);
    const state = readJSON(statePath) || ChannelManager.defaultState(channelId);

    // Load niche profile
    const nicheId = process.env[`CHANNEL_${channelId}_NICHE`] || `channel_${channelId}`;
    const niche = await NicheProfiler.load(nicheId);

    return {
      channelId,
      youtubeChannelId: process.env[`CHANNEL_${channelId}_ID`] || null,
      hasOAuth: !!(process.env[`CHANNEL_${channelId}_REFRESH_TOKEN`]),
      niche,
      state,
      nicheId
    };
  }

  /**
   * Update a channel's operational state
   */
  static async updateState(channelId, updates) {
    const statePath = path.join(DATA_DIR, `channel_${channelId}_state.json`);
    ensureDir(DATA_DIR);

    const current = readJSON(statePath) || ChannelManager.defaultState(channelId);
    const updated = {
      ...current,
      ...updates,
      channelId,
      lastUpdated: new Date().toISOString()
    };

    writeJSON(statePath, updated);
    log.channel(channelId).debug(`State updated: ${JSON.stringify(updates)}`);
    return updated;
  }

  /**
   * Set channel to cooldown after an upload
   */
  static async startCooldown(channelId) {
    const minGapHours = parseInt(process.env.MIN_UPLOAD_GAP_HOURS || '4', 10);
    const cooldownUntil = new Date(Date.now() + minGapHours * 60 * 60 * 1000).toISOString();

    return ChannelManager.updateState(channelId, {
      status: 'cooldown',
      cooldownUntil,
      lastUploadAt: new Date().toISOString()
    });
  }

  /**
   * Check if a channel has completed its cooldown
   */
  static isCooledDown(channelState) {
    if (channelState.status === 'paused' || channelState.status === 'flagged') return false;
    if (!channelState.cooldownUntil) return true;
    return new Date() >= new Date(channelState.cooldownUntil);
  }

  /**
   * Record a successful upload for a channel
   */
  static async recordUpload(channelId, videoData) {
    const statePath = path.join(DATA_DIR, `channel_${channelId}_state.json`);
    const state = readJSON(statePath) || ChannelManager.defaultState(channelId);

    const uploadRecord = {
      videoId: videoData.videoId,
      title: videoData.title,
      keyword: videoData.keyword,
      uploadedAt: new Date().toISOString(),
      versionType: videoData.versionType || 'pillar'
    };

    state.uploadHistory = state.uploadHistory || [];
    state.uploadHistory.push(uploadRecord);

    // Keep last 100 uploads in memory
    if (state.uploadHistory.length > 100) {
      state.uploadHistory = state.uploadHistory.slice(-100);
    }

    state.totalUploads = (state.totalUploads || 0) + 1;
    state.lastUploadAt = uploadRecord.uploadedAt;
    state.status = 'cooldown';

    writeJSON(statePath, { ...state, lastUpdated: new Date().toISOString() });
    log.channel(channelId).info(`Upload recorded: "${videoData.title}"`);

    return uploadRecord;
  }

  /**
   * Flag a channel as having a YouTube warning/strike
   */
  static async flagChannel(channelId, reason) {
    log.channel(channelId).error(`CHANNEL FLAGGED: ${reason}`);
    return ChannelManager.updateState(channelId, {
      status: 'flagged',
      flagReason: reason,
      flaggedAt: new Date().toISOString()
    });
  }

  /**
   * Get summary stats for all channels
   */
  static async getSummary() {
    const channels = await ChannelManager.loadAll();
    return Object.values(channels).map((ch) => ({
      channelId: ch.channelId,
      niche: ch.niche.category,
      status: ch.state.status,
      totalUploads: ch.state.totalUploads || 0,
      lastUploadAt: ch.state.lastUploadAt || 'Never',
      cooldownUntil: ch.state.cooldownUntil || null,
      hasOAuth: ch.hasOAuth,
      weeklyUploads: ChannelManager.countRecentUploads(ch.state, 7)
    }));
  }

  /**
   * Count uploads in the last N days
   */
  static countRecentUploads(state, days) {
    if (!state.uploadHistory?.length) return 0;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return state.uploadHistory.filter((u) => new Date(u.uploadedAt) >= cutoff).length;
  }

  /**
   * Default channel state
   */
  static defaultState(channelId) {
    return {
      channelId,
      status: 'idle',
      totalUploads: 0,
      uploadHistory: [],
      cooldownUntil: null,
      lastUploadAt: null,
      flagReason: null,
      flaggedAt: null,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Pause a channel (stops automation without flagging)
   */
  static async pauseChannel(channelId) {
    return ChannelManager.updateState(channelId, { status: 'paused' });
  }

  /**
   * Resume a paused channel
   */
  static async resumeChannel(channelId) {
    return ChannelManager.updateState(channelId, { status: 'idle', cooldownUntil: null });
  }
}
