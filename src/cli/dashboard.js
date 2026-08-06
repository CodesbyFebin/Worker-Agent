/**
 * CC-OS CLI Dashboard
 * Real-time multi-channel status display with live refresh.
 *
 * Shows:
 *  - All 10 channels: status, niche, last upload, weekly count
 *  - Master queue stats
 *  - Health summary
 *  - Recent A/B test results
 *  - System resource summary
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { ChannelManager } from '../layers/layer4-multi-runner/channel-manager.js';
import { MasterQueue } from '../layers/layer4-multi-runner/master-queue.js';
import { ChannelHealthMonitor } from '../layers/layer4-multi-runner/channel-health-monitor.js';
import { ABTester } from '../layers/layer5-optimizer/ab-tester.js';
import logger from '../utils/logger.js';

export async function showDashboard() {
  console.clear();
  await renderDashboard();

  // Auto-refresh every 30 seconds
  const interval = setInterval(async () => {
    console.clear();
    await renderDashboard();
  }, 30000);

  // Ctrl+C handler
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(chalk.gray('\nDashboard closed.'));
    process.exit(0);
  });
}

async function renderDashboard() {
  const now = new Date().toLocaleString();

  // Header
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('  CC-OS  Content Creator Operating System') + chalk.cyan('                   ║'));
  console.log(chalk.cyan('║') + chalk.gray(`  ${now}`) + chalk.cyan('                              ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
  console.log();

  // Channel status table
  const channels = await ChannelManager.getSummary();
  const healthSummary = await ChannelHealthMonitor.getDashboardSummary();
  const healthMap = {};
  for (const ch of healthSummary.channels) healthMap[ch.channelId] = ch;

  const channelTable = new Table({
    head: [
      chalk.bold('CH'), chalk.bold('Niche'), chalk.bold('Status'),
      chalk.bold('Health'), chalk.bold('Weekly'), chalk.bold('Last Upload'), chalk.bold('OAuth')
    ],
    colWidths: [5, 14, 13, 10, 8, 20, 7],
    style: { border: ['gray'], head: [] }
  });

  for (const ch of channels) {
    const health = healthMap[ch.channelId];
    const statusColor = {
      idle: chalk.green, generating: chalk.yellow, uploading: chalk.blue,
      cooldown: chalk.gray, paused: chalk.magenta, flagged: chalk.red,
      scheduled: chalk.cyan
    }[ch.status] || chalk.white;

    const healthColor = {
      healthy: chalk.green, warning: chalk.yellow,
      degraded: chalk.hex('#FFA500'), critical: chalk.red
    }[health?.status || 'healthy'] || chalk.green;

    const lastUpload = ch.lastUploadAt
      ? new Date(ch.lastUploadAt).toLocaleDateString()
      : chalk.gray('Never');

    channelTable.push([
      chalk.bold(`#${ch.channelId}`),
      chalk.cyan(ch.niche.slice(0, 12)),
      statusColor(ch.status),
      healthColor(health?.status || 'healthy'),
      chalk.white(String(ch.weeklyUploads || 0)),
      chalk.gray(lastUpload),
      ch.hasOAuth ? chalk.green('✓') : chalk.red('✗')
    ]);
  }

  console.log(chalk.bold('  CHANNEL STATUS'));
  console.log(channelTable.toString());
  console.log();

  // Queue stats
  const queueStats = MasterQueue.getStats();
  console.log(chalk.bold('  MASTER QUEUE'));
  console.log(chalk.gray('  ┌─────────────────────────────────────────┐'));
  console.log(`  │ ${chalk.green('Pending:')} ${String(queueStats.pending).padEnd(4)} ${chalk.yellow('Assigned:')} ${String(queueStats.assigned).padEnd(4)} ${chalk.gray('Completed:')} ${String(queueStats.completed).padEnd(6)} │`);
  console.log(`  │ ${chalk.red('Failed:')}  ${String(queueStats.failed).padEnd(4)} Avg Score: ${(queueStats.avgOpportunityScore * 100).toFixed(0).padEnd(3)}%                  │`);
  if (queueStats.topKeywords.length > 0) {
    const top = queueStats.topKeywords.slice(0, 3).join(', ');
    console.log(`  │ ${chalk.bold('Top:')} ${chalk.cyan(top.slice(0, 40).padEnd(40))} │`);
  }
  console.log(chalk.gray('  └─────────────────────────────────────────┘'));
  console.log();

  // Health summary
  console.log(chalk.bold('  SYSTEM HEALTH'));
  const healthBar = [
    chalk.green(`🟢 Healthy: ${healthSummary.healthy}`),
    chalk.yellow(`🟡 Warning: ${healthSummary.warning}`),
    chalk.hex('#FFA500')(`🟠 Degraded: ${healthSummary.degraded}`),
    chalk.red(`🔴 Critical: ${healthSummary.critical}`)
  ].join('  ');
  console.log(`  ${healthBar}`);
  console.log();

  // A/B test results
  const abInsights = ABTester.getResolvedInsights(7);
  console.log(chalk.bold('  A/B TESTS (Last 7 Days)'));
  console.log(`  Tests: ${abInsights.totalTests} | Success Rate: ${(abInsights.successRate * 100).toFixed(0)}% | Avg CTR Lift: +${(abInsights.avgCTRImprovement * 100).toFixed(1)}%`);
  if (abInsights.winningTitles?.length > 0) {
    const sample = abInsights.winningTitles[0];
    console.log(chalk.gray(`  Best: "${sample.title?.slice(0, 55)}" (CTR: ${(sample.ctr * 100).toFixed(1)}%)`));
  }
  console.log();

  // Footer
  console.log(chalk.gray('  Auto-refreshes every 30s | Ctrl+C to exit | run `ccos generate` to force a cycle'));
}
