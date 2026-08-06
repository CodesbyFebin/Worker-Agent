/**
 * CLI Setup Command
 * Interactive OAuth setup and channel configuration.
 */

import chalk from 'chalk';
import express from 'express';
import { google } from 'googleapis';
import { NicheProfiler } from '../layers/layer1-data-brain/niche-profiler.js';
import logger from '../utils/logger.js';

const log = logger.layer('CLI:Setup');

export async function setupChannels() {
  console.log(chalk.cyan('\n⚙️  CC-OS Channel Setup\n'));
  console.log(chalk.white('This wizard will help you configure OAuth for your YouTube channels.'));
  console.log(chalk.gray('Prerequisites: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env\n'));

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log(chalk.red('❌ YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env'));
    console.log(chalk.gray('   1. Go to https://console.cloud.google.com'));
    console.log(chalk.gray('   2. Create OAuth 2.0 credentials'));
    console.log(chalk.gray('   3. Add to .env file'));
    return;
  }

  console.log(chalk.green('✓ OAuth credentials found'));
  console.log(chalk.white('\nTo authorize a channel, run the OAuth flow:'));
  console.log(chalk.cyan('\n  node scripts/oauth.js --channel 01\n'));
  console.log(chalk.white('This will:'));
  console.log(chalk.gray('  1. Open a browser authorization URL'));
  console.log(chalk.gray('  2. Ask you to sign in to the YouTube channel'));
  console.log(chalk.gray('  3. Save the refresh token to .env automatically'));
  console.log(chalk.white('\nAlso ensure each channel has a niche profile at:'));
  console.log(chalk.cyan('  ./data/niches/channel_XX.json'));
  console.log(chalk.gray('\nRun `ccos generate --channel 1` to test generation after setup.\n'));
}
