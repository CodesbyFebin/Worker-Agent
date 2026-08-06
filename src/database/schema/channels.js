/**
 * Database Schema — Channel Health & Content Calendar
 * Phase 14 — Task 1
 *
 * CC-OS uses JSON-file-based persistence (no external DB required).
 * This module defines the schema, validators, and migration utilities
 * for the Phase 14 data models.
 *
 * Models:
 *  - ChannelHealth    : live health status, metrics, error tracking
 *  - ContentCalendar  : scheduled and published events across all platforms
 *  - AuditLog         : token rotations, bulk actions, critical events
 *  - SocialMetrics    : IG + FB view/engagement data per video
 */

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';

const DATA_ROOT = './data';
const SCHEMA_PATHS = {
  channelHealth:    `${DATA_ROOT}/health`,
  contentCalendar:  `${DATA_ROOT}/calendar`,
  auditLog:         `${DATA_ROOT}/social/audit.jsonl`,
  socialMetrics:    `${DATA_ROOT}/social/metrics`,
  channels:         `${DATA_ROOT}/analytics`
};

// ─── Channel Health Schema ───────────────────────────────────────────────────

/**
 * ChannelHealth record shape
 * health_status: 'healthy' | 'warning' | 'degraded' | 'critical' | 'unverified'
 */
export const ChannelHealthSchema = {
  defaults: (channelId) => ({
    channelId,
    health_status: 'unverified',
    health_updated_at: new Date().toISOString(),
    last_error_message: null,
    subscriber_count: 0,
    total_views_last_30d: 0,
    estimated_revenue: 0.00,

    // Platform availability
    platforms_active: ['youtube'],
    instagram_last_post: null,
    facebook_last_post: null,

    // YouTube metrics
    avg_ctr: 0,
    avg_view_duration_pct: 0,
    weekly_upload_count: 0,
    total_videos: 0,
    monetization_status: 'unverified',   // 'active' | 'limited' | 'disabled' | 'unverified'
    strike_count: 0,

    // Consecutive failure tracking
    consecutive_upload_failures: 0,
    last_successful_upload_at: null,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
};

// ─── Content Calendar Schema ─────────────────────────────────────────────────

/**
 * CalendarEvent record shape
 * platform: 'youtube' | 'instagram' | 'facebook'
 * status: 'scheduled' | 'processing' | 'published' | 'failed' | 'cancelled'
 */
export const CalendarEventSchema = {
  create: ({
    channelId, title, platform, scheduledTime,
    videoId = null, keyword = null, niche = null,
    workflowRunId = null
  }) => ({
    id: uuidv4(),
    channelId,
    workflowRunId,
    title,
    platform,
    keyword,
    niche,
    videoId,
    scheduled_time: new Date(scheduledTime).toISOString(),
    status: 'scheduled',
    published_at: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
};

// ─── Social Metrics Schema ────────────────────────────────────────────────────

export const SocialMetricsSchema = {
  create: ({ channelId, videoId, platform, youtubeVideoId = null }) => ({
    id: uuidv4(),
    channelId,
    videoId,
    youtubeVideoId,
    platform,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    reach: 0,
    impressions: 0,
    engagement_rate: 0,
    fetched_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  })
};

// ─── Database Access Layer ────────────────────────────────────────────────────

export class ChannelHealthDB {

  static getPath(channelId) {
    ensureDir(SCHEMA_PATHS.channelHealth);
    return path.join(SCHEMA_PATHS.channelHealth, `channel_${channelId}.json`);
  }

  static get(channelId) {
    const data = readJSON(ChannelHealthDB.getPath(channelId));
    return data || ChannelHealthSchema.defaults(channelId);
  }

  static save(channelId, data) {
    writeJSON(ChannelHealthDB.getPath(channelId), {
      ...data,
      updated_at: new Date().toISOString()
    });
  }

  static update(channelId, updates) {
    const current = ChannelHealthDB.get(channelId);
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    ChannelHealthDB.save(channelId, updated);
    return updated;
  }

  static getAll() {
    const records = {};
    for (let i = 1; i <= 10; i++) {
      const id = String(i).padStart(2, '0');
      records[id] = ChannelHealthDB.get(id);
    }
    return records;
  }

  /** Get aggregate health summary */
  static getSummary() {
    const all = ChannelHealthDB.getAll();
    const counts = { healthy: 0, warning: 0, degraded: 0, critical: 0, unverified: 0 };
    let totalRevenue = 0;
    let totalViews = 0;
    let totalSubs = 0;

    for (const record of Object.values(all)) {
      counts[record.health_status] = (counts[record.health_status] || 0) + 1;
      totalRevenue += record.estimated_revenue || 0;
      totalViews += record.total_views_last_30d || 0;
      totalSubs += record.subscriber_count || 0;
    }

    return {
      counts,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalViews,
      totalSubscribers: totalSubs,
      updatedAt: new Date().toISOString()
    };
  }
}

export class CalendarDB {

  static getPath(channelId) {
    ensureDir(SCHEMA_PATHS.contentCalendar);
    return path.join(SCHEMA_PATHS.contentCalendar, `calendar_${channelId}.json`);
  }

  static getAllPath() {
    ensureDir(SCHEMA_PATHS.contentCalendar);
    return path.join(SCHEMA_PATHS.contentCalendar, 'all_events.json');
  }

  static addEvent(event) {
    const validated = CalendarEventSchema.create(event);
    // Store per-channel
    const channelPath = CalendarDB.getPath(event.channelId);
    const channelData = readJSON(channelPath) || { events: [] };
    channelData.events.push(validated);
    writeJSON(channelPath, channelData);

    // Also store in master calendar
    const masterPath = CalendarDB.getAllPath();
    const masterData = readJSON(masterPath) || { events: [] };
    masterData.events.push(validated);
    // Keep last 500 events
    if (masterData.events.length > 500) masterData.events = masterData.events.slice(-500);
    writeJSON(masterPath, masterData);

    return validated;
  }

  static updateEvent(eventId, updates) {
    const masterPath = CalendarDB.getAllPath();
    const data = readJSON(masterPath) || { events: [] };
    const idx = data.events.findIndex((e) => e.id === eventId);
    if (idx === -1) return null;

    data.events[idx] = { ...data.events[idx], ...updates, updated_at: new Date().toISOString() };
    writeJSON(masterPath, data);

    // Also update per-channel file
    const channelId = data.events[idx].channelId;
    if (channelId) {
      const channelPath = CalendarDB.getPath(channelId);
      const channelData = readJSON(channelPath) || { events: [] };
      const chIdx = channelData.events.findIndex((e) => e.id === eventId);
      if (chIdx >= 0) {
        channelData.events[chIdx] = data.events[idx];
        writeJSON(channelPath, channelData);
      }
    }

    return data.events[idx];
  }

  static getRange(startDate, endDate, channelId = null) {
    const path = channelId ? CalendarDB.getPath(channelId) : CalendarDB.getAllPath();
    const data = readJSON(path) || { events: [] };
    const start = new Date(startDate);
    const end = new Date(endDate);

    return data.events.filter((e) => {
      const t = new Date(e.scheduled_time);
      return t >= start && t <= end;
    }).sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
  }

  static reschedule(eventId, newScheduledTime) {
    return CalendarDB.updateEvent(eventId, {
      scheduled_time: new Date(newScheduledTime).toISOString(),
      status: 'scheduled'
    });
  }

  static markPublished(eventId, videoId) {
    return CalendarDB.updateEvent(eventId, {
      status: 'published',
      videoId,
      published_at: new Date().toISOString()
    });
  }

  static markFailed(eventId, error) {
    return CalendarDB.updateEvent(eventId, {
      status: 'failed',
      error_message: error
    });
  }
}

export class AuditLogDB {

  static append(entry) {
    ensureDir(path.dirname(SCHEMA_PATHS.auditLog));
    const record = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    try {
      fs.appendFileSync(SCHEMA_PATHS.auditLog, JSON.stringify(record) + '\n', 'utf-8');
    } catch {}
    return record;
  }

  static getRecent(limit = 50) {
    try {
      const raw = fs.readFileSync(SCHEMA_PATHS.auditLog, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map((l) => JSON.parse(l)).reverse();
    } catch {
      return [];
    }
  }
}

export class SocialMetricsDB {

  static save(metrics) {
    ensureDir(SCHEMA_PATHS.socialMetrics);
    const filePath = path.join(
      SCHEMA_PATHS.socialMetrics,
      `${metrics.channelId}_${metrics.platform}.json`
    );
    const data = readJSON(filePath) || { records: [] };
    data.records.push(metrics);
    if (data.records.length > 200) data.records = data.records.slice(-200);
    writeJSON(filePath, data);
  }

  static getForVideo(channelId, videoId) {
    const platforms = ['youtube', 'instagram', 'facebook'];
    const result = {};
    for (const platform of platforms) {
      const filePath = path.join(SCHEMA_PATHS.socialMetrics, `${channelId}_${platform}.json`);
      const data = readJSON(filePath);
      const match = data?.records?.find((r) => r.videoId === videoId);
      if (match) result[platform] = match;
    }
    return result;
  }

  static getChannelTotals(channelId, days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const platforms = ['youtube', 'instagram', 'facebook'];
    const totals = {};

    for (const platform of platforms) {
      const filePath = path.join(SCHEMA_PATHS.socialMetrics, `${channelId}_${platform}.json`);
      const data = readJSON(filePath);
      const recent = (data?.records || []).filter((r) => new Date(r.fetched_at) >= cutoff);
      totals[platform] = {
        views: recent.reduce((s, r) => s + (r.views || 0), 0),
        likes: recent.reduce((s, r) => s + (r.likes || 0), 0),
        comments: recent.reduce((s, r) => s + (r.comments || 0), 0),
        videoCount: recent.length
      };
    }

    return totals;
  }
}

/** Run initial migration — create all required directories and seed files */
export function runMigration() {
  for (const dirPath of Object.values(SCHEMA_PATHS)) {
    if (!dirPath.endsWith('.json') && !dirPath.endsWith('.jsonl')) {
      ensureDir(dirPath);
    } else {
      ensureDir(path.dirname(dirPath));
    }
  }

  // Seed empty channel health records for all 10 channels
  for (let i = 1; i <= 10; i++) {
    const id = String(i).padStart(2, '0');
    const record = ChannelHealthDB.get(id);
    if (record.health_status === 'unverified') {
      ChannelHealthDB.save(id, ChannelHealthSchema.defaults(id));
    }
  }

  return { migrated: true, timestamp: new Date().toISOString() };
}
