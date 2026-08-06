#!/usr/bin/env node

/**
 * CC-OS — Content Creator Operating System
 * Main Entry Point
 * 
 * The central command center for managing 10 YouTube channels
 * with AI-powered automation, trend prediction, and monetization optimization.
 */

import dotenv from 'dotenv';
import chalk from 'chalk';
import figlet from 'figlet';
import { Command } from 'commander';
import { startOrchestrator } from './orchestrator/master.js';
import { showDashboard } from './cli/dashboard.js';
import { generateContent } from './cli/generate.js';
import { analyzePerformance } from './cli/analyze.js';
import { setupChannels } from './cli/setup.js';
import logger from './utils/logger.js';

dotenv.config();

const program = new Command();

// Display banner
console.log(
  chalk.cyan(
    figlet.textSync('CC-OS', {
      font: 'Slant',
      horizontalLayout: 'default'
    })
  )
);
console.log(chalk.gray('Content Creator Operating System v1.0'));
console.log(chalk.gray('━'.repeat(60)));
console.log();

program
  .name('ccos')
  .description('YouTube Content Creator Operating System')
  .version('1.0.0');

program
  .command('start')
  .description('Start the master orchestrator (runs continuously)')
  .action(async () => {
    logger.info('Starting CC-OS Master Orchestrator...');
    await startOrchestrator();
  });

program
  .command('dashboard')
  .description('Show real-time channel dashboard')
  .action(async () => {
    await showDashboard();
  });

program
  .command('generate')
  .description('Generate content for a specific channel')
  .option('-c, --channel <number>', 'Channel number (1-10)', '1')
  .option('-n, --niche <name>', 'Force specific niche profile')
  .option('-t, --topic <text>', 'Force specific topic')
  .action(async (options) => {
    await generateContent(options);
  });

program
  .command('analyze')
  .description('Analyze performance across all channels')
  .option('-c, --channel <number>', 'Analyze specific channel only')
  .option('-d, --days <number>', 'Days to analyze', '7')
  .action(async (options) => {
    await analyzePerformance(options);
  });

program
  .command('setup')
  .description('Setup and configure channels (OAuth, profiles, etc.)')
  .action(async () => {
    await setupChannels();
  });

program
  .command('optimize')
  .description('Run the self-improvement optimizer manually')
  .action(async () => {
    logger.info('Running manual optimization cycle...');
    const { runOptimizationCycle } = await import('./layers/layer5-optimizer/self-improver.js');
    await runOptimizationCycle();
    logger.info('Optimization complete.');
  });

program
  .command('mission-control')
  .description('Start Mission Control dashboard server only (port 4002)')
  .action(async () => {
    const { startMissionControl } = await import('./dashboard/index.js');
    await startMissionControl();
    logger.info('Mission Control running at http://localhost:4002');
  });

program
  .command('crosspost')
  .description('Manually crosspost a video to Instagram + Facebook')
  .option('-c, --channel <number>', 'Channel number', '1')
  .option('-v, --video <path>', 'Path to video file')
  .option('--topic <text>', 'Topic/keyword for captions')
  .action(async (options) => {
    const { runCrosspostCycle } = await import('./social/index.js');
    const { NicheProfiler } = await import('./layers/layer1-data-brain/niche-profiler.js');
    const channelId = String(options.channel).padStart(2, '0');
    const niche = await NicheProfiler.getForChannel(options.channel);
    const mockPackage = {
      script: { id: `manual_${Date.now()}`, keyword: options.topic || 'content' },
      metadata: { primaryTitle: options.topic || 'New Video' },
      thumbnails: [],
      contentVersions: { short: null },
      videoPath: options.video || null
    };
    const result = await runCrosspostCycle(mockPackage, { channelId, niche });
    logger.info('Crosspost result:', JSON.stringify(result, null, 2));
  });

program
  .command('health')
  .description('Run channel health check for all channels')
  .action(async () => {
    const { HealthWorker } = await import('./dashboard/health.worker.js');
    const results = await HealthWorker.runAll();
    const { ChannelHealthDB } = await import('./database/schema/channels.js');
    const summary = ChannelHealthDB.getSummary();
    logger.info(`Health summary: ${JSON.stringify(summary, null, 2)}`);
  });

program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
