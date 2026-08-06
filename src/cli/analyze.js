/**
 * CLI Analyze Command
 * Performance analysis across all channels.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { ChannelManager } from '../layers/layer4-multi-runner/channel-manager.js';
import { RetentionAnalyzer } from '../layers/layer5-optimizer/retention-analyzer.js';
import { ABTester } from '../layers/layer5-optimizer/ab-tester.js';
import { YouTubeAPI } from '../youtube/youtube-api.js';

export async function analyzePerformance(options = {}) {
  const days = parseInt(options.days || 7, 10);
  console.log(chalk.cyan(`\n📊 Analyzing performance (last ${days} days)...\n`));

  const channels = await ChannelManager.loadAll();

  const table = new Table({
    head: [chalk.bold('CH'), chalk.bold('Niche'), chalk.bold('Uploads'), chalk.bold('Subs'), chalk.bold('Views'), chalk.bold('Avg AVD'), chalk.bold('Status')],
    colWidths: [5, 14, 9, 8, 10, 10, 12]
  });

  for (const [channelId, channel] of Object.entries(channels)) {
    const stats = await YouTubeAPI.getChannelStats(channelId);
    const retentionData = RetentionAnalyzer.aggregateChannelInsights(channelId);
    const weeklyUploads = ChannelManager.countRecentUploads(channel.state, days);

    table.push([
      chalk.bold(`#${channelId}`),
      chalk.cyan(channel.niche.category.slice(0, 12)),
      chalk.white(String(weeklyUploads)),
      chalk.green(stats ? String(stats.subscriberCount) : 'N/A'),
      chalk.blue(stats ? String(stats.viewCount) : 'N/A'),
      retentionData ? chalk.yellow(`${retentionData.avgAVDPercent}%`) : chalk.gray('N/A'),
      chalk.white(channel.state.status)
    ]);
  }

  console.log(table.toString());

  // A/B insights
  const abInsights = ABTester.getResolvedInsights(days);
  console.log(chalk.bold('\n  A/B Test Summary'));
  console.log(`  Resolved: ${abInsights.totalTests} | Win Rate: ${(abInsights.successRate * 100).toFixed(0)}% | Avg CTR Lift: +${(abInsights.avgCTRImprovement * 100).toFixed(1)}%`);

  if (abInsights.winningTitles.length > 0) {
    console.log(chalk.bold('\n  Top Winning Titles:'));
    for (const t of abInsights.winningTitles.slice(0, 3)) {
      console.log(chalk.gray(`    "${t.title}" — CTR: ${(t.ctr * 100).toFixed(1)}% (+${(t.improvement * 100).toFixed(0)}%)`));
    }
  }

  console.log();
}
