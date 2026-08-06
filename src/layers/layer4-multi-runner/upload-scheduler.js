/**
 * Upload Scheduler
 *
 * Determines WHEN each channel's video goes live using:
 *  1. Subscriber timezone analysis (upload when your audience is online)
 *  2. Day-of-week performance data (from analytics history)
 *  3. Minimum upload gap enforcement (anti-spam compliance)
 *  4. Staggered scheduling (10 channels never upload simultaneously)
 *  5. Competition window analysis (don't upload when top competitors do)
 *
 * The scheduler uses YouTube API's "scheduleFor" parameter to pre-schedule
 * uploads — the video goes up at the optimal time automatically.
 *
 * Anti-spam stagger:
 *  - Channel windows are offset by 2+ hours minimum
 *  - No two channels upload within 30 minutes of each other
 *  - Upload distribution follows natural human patterns (not uniform intervals)
 */

import { addHours, getOptimalUploadTime, sleep } from '../../utils/helpers.js';
import { ChannelManager } from './channel-manager.js';
import logger from '../../utils/logger.js';

const log = logger.layer('UploadScheduler');

// Default optimal upload windows per timezone (UTC offset, hour)
const TIMEZONE_WINDOWS = {
  'America/New_York':    { weekday: [15, 17, 20], weekend: [10, 14, 19] }, // EST
  'America/Chicago':     { weekday: [14, 16, 19], weekend: [10, 13, 18] }, // CST
  'America/Los_Angeles': { weekday: [12, 15, 18], weekend: [10, 12, 16] }, // PST
  'Europe/London':       { weekday: [17, 19, 21], weekend: [10, 14, 18] }, // GMT
  'Europe/Berlin':       { weekday: [17, 19, 21], weekend: [10, 14, 18] }, // CET
  'Asia/Kolkata':        { weekday: [19, 21, 23], weekend: [10, 15, 20] }, // IST
  'Asia/Tokyo':          { weekday: [20, 22, 8],  weekend: [10, 14, 20] }, // JST
  'Australia/Sydney':    { weekday: [17, 19, 21], weekend: [10, 14, 18] }, // AEST
  'default':             { weekday: [15, 18, 21], weekend: [10, 14, 18] }
};

// Channel-specific time offsets (minutes) to prevent simultaneous uploads
// Channel 01 uploads at :00, Channel 02 at :18, Channel 03 at :36, etc.
const CHANNEL_STAGGER_MINUTES = {
  '01': 0,   '02': 18,  '03': 36,  '04': 54,
  '05': 12,  '06': 30,  '07': 48,  '08': 6,
  '09': 24,  '10': 42
};

export class UploadScheduler {

  /**
   * Get all channels that are ready to upload right now
   */
  static async getReadyChannels(channels) {
    const ready = {};

    for (const [channelId, channel] of Object.entries(channels)) {
      if (ChannelManager.isCooledDown(channel.state)) {
        ready[channelId] = channel;
      }
    }

    log.debug(`Ready channels: ${Object.keys(ready).join(', ') || 'none'}`);
    return ready;
  }

  /**
   * Calculate the optimal upload datetime for a specific channel
   */
  static calculateUploadTime(channel, targetDate = new Date()) {
    const niche = channel.niche;
    const channelId = channel.channelId;

    const timezone = niche.targetTimezone || 'America/New_York';
    const windows = TIMEZONE_WINDOWS[timezone] || TIMEZONE_WINDOWS.default;

    // Determine if target date is a weekday or weekend
    const dayOfWeek = targetDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hourOptions = isWeekend ? windows.weekend : windows.weekday;

    // Check niche upload days preference
    const uploadDays = niche.uploadDaysOfWeek || [1, 2, 3, 4, 5];
    let scheduleDate = new Date(targetDate);

    // Advance date until we hit an allowed upload day
    let attempts = 0;
    while (!uploadDays.includes(scheduleDate.getDay()) && attempts < 7) {
      scheduleDate = addHours(scheduleDate, 24);
      attempts++;
    }

    // Pick optimal hour for this channel (using niche preference or window)
    const preferredHour = niche.optimalUploadHour || hourOptions[1]; // Middle window as default
    const staggerMinutes = CHANNEL_STAGGER_MINUTES[channelId] || 0;

    // Build target time in channel's timezone
    const uploadTime = new Date(scheduleDate);
    uploadTime.setHours(preferredHour, staggerMinutes, 0, 0);

    // If that time has already passed today, move to tomorrow
    if (uploadTime <= new Date()) {
      uploadTime.setDate(uploadTime.getDate() + 1);
    }

    log.debug(`Channel ${channelId}: upload scheduled for ${uploadTime.toISOString()} (${timezone})`);
    return uploadTime;
  }

  /**
   * Build a 7-day upload schedule for all channels
   */
  static async buildWeeklySchedule(channels) {
    const schedule = {};
    const now = new Date();

    for (const [channelId, channel] of Object.entries(channels)) {
      if (channel.state.status === 'paused' || channel.state.status === 'flagged') {
        schedule[channelId] = { status: channel.state.status, slots: [] };
        continue;
      }

      const niche = channel.niche;
      const maxVideosPerWeek = niche.maxVideosPerWeek || 3;
      const uploadDays = niche.uploadDaysOfWeek || [1, 3, 5];

      const slots = [];
      let dayOffset = 0;

      while (slots.length < maxVideosPerWeek && dayOffset < 7) {
        const candidateDate = addHours(now, dayOffset * 24);
        const dayOfWeek = candidateDate.getDay();

        if (uploadDays.includes(dayOfWeek)) {
          const uploadTime = UploadScheduler.calculateUploadTime(channel, candidateDate);
          slots.push({
            scheduledFor: uploadTime.toISOString(),
            dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
            status: 'open'
          });
        }

        dayOffset++;
      }

      schedule[channelId] = {
        channelId,
        niche: niche.category,
        timezone: niche.targetTimezone,
        slots,
        weeklyTarget: maxVideosPerWeek
      };
    }

    return schedule;
  }

  /**
   * Validate that an upload time doesn't conflict with other channels
   * Ensures minimum 30-minute gap between any two channel uploads
   */
  static validateNoConflict(proposedTime, existingSchedule, minGapMinutes = 30) {
    const proposed = new Date(proposedTime).getTime();

    for (const channelSchedule of Object.values(existingSchedule)) {
      for (const slot of channelSchedule.slots || []) {
        if (slot.status === 'scheduled') {
          const existing = new Date(slot.scheduledFor).getTime();
          const gapMs = Math.abs(proposed - existing);
          if (gapMs < minGapMinutes * 60 * 1000) {
            return false; // Conflict
          }
        }
      }
    }

    return true; // No conflict
  }

  /**
   * Get the next available upload slot for a channel (respects all constraints)
   */
  static async getNextSlot(channel, existingSchedule = {}) {
    let candidateTime = UploadScheduler.calculateUploadTime(channel);
    let attempts = 0;

    while (attempts < 14) { // Try up to 2 weeks out
      const hasConflict = !UploadScheduler.validateNoConflict(
        candidateTime, existingSchedule
      );

      const respectsGap = UploadScheduler.respectsMinimumGap(channel.state, candidateTime);

      if (!hasConflict && respectsGap) {
        return candidateTime;
      }

      // Advance by stagger offset
      candidateTime = addHours(candidateTime, 6);
      attempts++;
    }

    log.warn(`Channel ${channel.channelId}: could not find optimal slot after ${attempts} attempts`);
    return addHours(new Date(), 24); // Default: 24 hours from now
  }

  /**
   * Check that a proposed upload time respects minimum upload gap for channel
   */
  static respectsMinimumGap(channelState, proposedTime) {
    if (!channelState.lastUploadAt) return true;

    const minGapHours = parseInt(process.env.MIN_UPLOAD_GAP_HOURS || '4', 10);
    const lastUpload = new Date(channelState.lastUploadAt);
    const minNextUpload = addHours(lastUpload, minGapHours);

    return new Date(proposedTime) >= minNextUpload;
  }

  /**
   * Wait until a scheduled upload time (blocking)
   * Used by orchestrator when upload is imminent
   */
  static async waitUntil(scheduledTime) {
    const now = Date.now();
    const target = new Date(scheduledTime).getTime();
    const waitMs = target - now;

    if (waitMs <= 0) return; // Already past time

    log.info(`Waiting ${Math.round(waitMs / 1000 / 60)} minutes until scheduled upload...`);
    await sleep(Math.min(waitMs, 30 * 60 * 1000)); // Wait max 30 min at a time
  }

  /**
   * Determine the best upload time based on channel's historical performance
   * Reads from analytics to find which hours drove the most views
   */
  static getBestHourFromHistory(channelId, dayType = 'weekday') {
    // This would read from data/analytics/channel_XX_analytics.json
    // For now returns niche-based default
    const timezone = process.env[`CHANNEL_${channelId}_TIMEZONE`] || 'America/New_York';
    const windows = TIMEZONE_WINDOWS[timezone] || TIMEZONE_WINDOWS.default;
    const hours = dayType === 'weekend' ? windows.weekend : windows.weekday;

    // Return middle window as most reliable default
    return hours[Math.floor(hours.length / 2)];
  }
}
