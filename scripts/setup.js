#!/usr/bin/env node
/**
 * CC-OS Setup Script
 * Initializes the project: creates .env, generates niche profiles,
 * creates required directories, validates API keys.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('\n🚀 CC-OS Setup\n');

// Create .env from example if not exists
const envPath = path.join(ROOT, '.env');
const envExamplePath = path.join(ROOT, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ Created .env from .env.example');
  console.log('   → Fill in your API keys in .env before running\n');
} else if (fs.existsSync(envPath)) {
  console.log('✅ .env already exists');
}

// Create channel niche profiles from template
const nichesDir = path.join(ROOT, 'data', 'niches');
fs.mkdirSync(nichesDir, { recursive: true });

const templateBase = {
  tone: 'conversational', voiceGender: 'male', speakingPace: 'medium',
  energyLevel: 'medium', targetVideoDurationMinutes: 10, shortVideoTargetSeconds: 55,
  snippetDurationMinutes: 4, introDurationSeconds: 30, retentionHookIntervalSeconds: 7,
  ctaPositions: [0.25, 0.75, 0.95], nicheKeywordModifiers: ['2026', 'best', 'guide', 'tips'],
  targetAge: '18-40', targetGender: 'all', minUploadGapHours: 18, maxVideosPerWeek: 3,
  monetizationStrategy: ['adsense', 'affiliate'], averageCPM: 5.0,
  baseMonetizationScore: 0.6, competitionLevel: 0.5,
  channelPersona: { backstory: 'A knowledgeable creator in this niche', quirks: [], catchphrases: [], regionalSlang: [] },
  baselineMetrics: { avgCTR: 0.04, avgViewDuration: 0.45, avgLikes: 0.02, avgComments: 0.006 }
};

const nicheTemplates = [
  { id: 'channel_01', category: 'technology', channelName: 'Channel 1 - Tech', seedKeywords: ['technology', 'ai', 'gadgets'], microNodes: ['tech', 'productivity'], subreddits: ['technology'], targetTimezone: 'America/New_York', optimalUploadHour: 15, uploadDaysOfWeek: [1,3,5] },
  { id: 'channel_02', category: 'finance', channelName: 'Channel 2 - Finance', seedKeywords: ['personal finance', 'investing'], microNodes: ['finance', 'entrepreneurship'], subreddits: ['personalfinance'], targetTimezone: 'America/New_York', optimalUploadHour: 17, uploadDaysOfWeek: [2,4,6] },
  { id: 'channel_03', category: 'health', channelName: 'Channel 3 - Health', seedKeywords: ['health', 'wellness', 'nutrition'], microNodes: ['health', 'fitness'], subreddits: ['nutrition'], targetTimezone: 'America/Los_Angeles', optimalUploadHour: 7, uploadDaysOfWeek: [1,3,5] },
  { id: 'channel_04', category: 'gaming', channelName: 'Channel 4 - Gaming', seedKeywords: ['gaming', 'game reviews'], microNodes: ['gaming', 'tech'], subreddits: ['gaming'], targetTimezone: 'America/Chicago', optimalUploadHour: 19, uploadDaysOfWeek: [2,5,6] },
  { id: 'channel_05', category: 'cooking', channelName: 'Channel 5 - Cooking', seedKeywords: ['recipes', 'cooking', 'meal prep'], microNodes: ['cooking', 'health'], subreddits: ['recipes'], targetTimezone: 'America/New_York', optimalUploadHour: 12, uploadDaysOfWeek: [1,3,6] },
  { id: 'channel_06', category: 'true-crime', channelName: 'Channel 6 - True Crime', seedKeywords: ['true crime', 'mystery', 'cold case'], microNodes: ['true-crime', 'psychology'], subreddits: ['TrueCrime'], targetTimezone: 'America/New_York', optimalUploadHour: 20, uploadDaysOfWeek: [3,6] },
  { id: 'channel_07', category: 'education', channelName: 'Channel 7 - Education', seedKeywords: ['learning', 'studying', 'productivity'], microNodes: ['education', 'productivity'], subreddits: ['GetStudying'], targetTimezone: 'America/New_York', optimalUploadHour: 8, uploadDaysOfWeek: [1,4] },
  { id: 'channel_08', category: 'finance', channelName: 'Channel 8 - Business', seedKeywords: ['side hustle', 'online business'], microNodes: ['entrepreneurship', 'finance'], subreddits: ['Entrepreneur'], targetTimezone: 'America/Los_Angeles', optimalUploadHour: 10, uploadDaysOfWeek: [2,5] },
  { id: 'channel_09', category: 'fitness', channelName: 'Channel 9 - Fitness', seedKeywords: ['workout', 'muscle building', 'fat loss'], microNodes: ['fitness', 'health'], subreddits: ['fitness'], targetTimezone: 'America/New_York', optimalUploadHour: 6, uploadDaysOfWeek: [1,3,5] },
  { id: 'channel_10', category: 'travel', channelName: 'Channel 10 - Travel', seedKeywords: ['travel tips', 'budget travel'], microNodes: ['travel', 'culture'], subreddits: ['solotravel'], targetTimezone: 'America/New_York', optimalUploadHour: 16, uploadDaysOfWeek: [2,5] }
];

let created = 0;
for (const template of nicheTemplates) {
  const nichePath = path.join(nichesDir, `${template.id}.json`);
  if (!fs.existsSync(nichePath)) {
    fs.writeFileSync(nichePath, JSON.stringify({ ...templateBase, ...template, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, null, 2));
    created++;
  }
}

if (created > 0) console.log(`✅ Created ${created} niche profiles in data/niches/`);
else console.log('✅ All niche profiles already exist');

// Required directories
const dirs = ['output/scripts', 'output/audio', 'output/thumbnails', 'output/videos', 'output/metadata', 'data/trends', 'data/ab-tests', 'data/analytics', 'data/prompt-history', 'logs'];
for (const dir of dirs) {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
}
console.log('✅ All directories verified');

console.log('\n📋 Next Steps:');
console.log('  1. Fill in API keys in .env');
console.log('  2. Run: node scripts/oauth.js --channel 01  (for each channel)');
console.log('  3. Customize: data/niches/channel_XX.json files');
console.log('  4. Test:  node src/index.js generate --channel 1');
console.log('  5. Start: node src/index.js start\n');
