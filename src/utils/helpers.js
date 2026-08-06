/**
 * CC-OS Utility Helpers
 * Shared utility functions used across all layers
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── String Utilities ───────────────────────────────────────

/**
 * Slugify a string for filenames/URLs
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate text to maxLength with ellipsis
 */
export function truncate(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Count words in a string
 */
export function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

/**
 * Estimate reading time in seconds (avg 150 words/min for speech)
 */
export function estimateSpeechDuration(text, wpm = 150) {
  const words = wordCount(text);
  return Math.ceil((words / wpm) * 60);
}

// ─── Array Utilities ─────────────────────────────────────────

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick random element from array
 */
export function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick N random unique elements
 */
export function pickRandomN(array, n) {
  return shuffle(array).slice(0, n);
}

/**
 * Chunk array into groups of size n
 */
export function chunk(array, n) {
  const result = [];
  for (let i = 0; i < array.length; i += n) {
    result.push(array.slice(i, i + n));
  }
  return result;
}

// ─── Date / Time Utilities ───────────────────────────────────

/**
 * Get current UTC timestamp string
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Add hours to a date
 */
export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Check if a date is at least N hours in the future
 */
export function isFutureByHours(date, hours) {
  return date.getTime() > addHours(new Date(), hours).getTime();
}

/**
 * Get optimal upload time for a timezone
 * Returns a Date for today at the optimal hour
 */
export function getOptimalUploadTime(timezone, preferredHour = 15) {
  // Returns a UTC timestamp corresponding to preferredHour in given timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  });
  const localHour = parseInt(formatter.format(now), 10);
  const hoursUntilOptimal = (preferredHour - localHour + 24) % 24;
  return addHours(now, hoursUntilOptimal);
}

// ─── File Utilities ──────────────────────────────────────────

/**
 * Read JSON file safely
 */
export function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write JSON file with pretty formatting
 */
export function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Append a line to a file
 */
export function appendLine(filePath, line) {
  fs.appendFileSync(filePath, line + '\n', 'utf-8');
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ─── Crypto / ID Utilities ───────────────────────────────────

/**
 * Generate a short unique ID
 */
export function shortId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Generate a content fingerprint hash
 */
export function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 12);
}

// ─── Math / Stats Utilities ──────────────────────────────────

/**
 * Calculate percentage
 */
export function pct(value, total) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10;
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate average of array
 */
export function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Moving average
 */
export function movingAverage(arr, window = 3) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return average(slice);
  });
}

// ─── Sleep / Retry ───────────────────────────────────────────

/**
 * Async sleep
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function N times with exponential backoff
 */
export async function retry(fn, attempts = 3, baseDelayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const delay = baseDelayMs * Math.pow(2, i);
      await sleep(delay);
    }
  }
}

// ─── Rate Limiter ─────────────────────────────────────────────

/**
 * Simple rate limiter token bucket
 */
export class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.windowMs);
    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      await sleep(waitTime);
      return this.throttle();
    }
    this.requests.push(now);
  }
}
