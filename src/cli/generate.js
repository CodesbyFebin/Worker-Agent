/**
 * CLI Generate Command
 * Manually trigger content generation for a specific channel.
 */

import ora from 'ora';
import chalk from 'chalk';
import { NicheProfiler } from '../layers/layer1-data-brain/niche-profiler.js';
import { runDataBrainCycle } from '../layers/layer1-data-brain/index.js';
import { runAssetForgeCycle } from '../layers/layer2-asset-forge/index.js';
import { runSanityShield } from '../layers/layer3-sanity-shield/index.js';
import logger from '../utils/logger.js';

const log = logger.layer('CLI:Generate');

export async function generateContent(options = {}) {
  const channelNum = options.channel || '1';
  const channelId = String(channelNum).padStart(2, '0');

  console.log(chalk.cyan(`\n🎬 Generating content for Channel ${channelId}...\n`));

  const spinner = ora('Loading niche profile...').start();

  try {
    // Load niche
    const niche = await NicheProfiler.getForChannel(channelNum);
    spinner.succeed(`Niche loaded: ${chalk.cyan(niche.category)} (${niche.id})`);

    // Override niche if specified
    if (options.niche) niche.category = options.niche;

    // Data Brain cycle
    spinner.start('Running Data Brain (trend discovery)...');
    let opportunities;

    if (options.topic) {
      // Manual topic override
      opportunities = [{
        keyword: options.topic,
        opportunityScore: 0.8,
        trendVelocity: 0.7,
        predictedPeakHours: 48,
        microNodes: niche.microNodes,
        videoTags: niche.seedKeywords,
        hashtags: niche.microNodes.map((n) => `#${n}`)
      }];
      spinner.succeed(`Using manual topic: "${options.topic}"`);
    } else {
      opportunities = await runDataBrainCycle(niche.id);
      spinner.succeed(`Found ${opportunities.length} content opportunities`);
    }

    if (opportunities.length === 0) {
      console.log(chalk.red('No opportunities found. Check your API keys in .env'));
      return;
    }

    const topOpp = opportunities[0];
    console.log(chalk.gray(`  → Top opportunity: "${topOpp.keyword}" (score: ${(topOpp.opportunityScore * 100).toFixed(0)}%)`));

    // Asset Forge
    spinner.start('Running Asset Forge (script + TTS + thumbnails)...');
    const contentPackage = await runAssetForgeCycle(topOpp, niche);
    spinner.succeed(`Assets generated: ${contentPackage.script.wordCount} words, ${contentPackage.thumbnails?.length} thumbnails`);

    // Sanity Shield
    spinner.start('Running Sanity Shield (compliance check)...');
    const shieldedPackage = await runSanityShield(contentPackage, niche);
    const score = shieldedPackage.shieldResults.overallScore;
    const passed = shieldedPackage.shieldResults.passed;

    if (passed) {
      spinner.succeed(`Shield passed: ${chalk.green((score * 100).toFixed(0) + '%')} ad-friendly`);
    } else {
      spinner.warn(`Shield warnings: ${shieldedPackage.shieldResults.warnings.join(', ')}`);
    }

    // Summary
    console.log('\n' + chalk.bold('─── Generation Summary ───'));
    console.log(chalk.white(`  Keyword:     ${topOpp.keyword}`));
    console.log(chalk.white(`  Title:       ${shieldedPackage.metadata?.primaryTitle}`));
    console.log(chalk.white(`  Duration:    ~${contentPackage.script.estimatedDurationMinutes} minutes`));
    console.log(chalk.white(`  Script ID:   ${contentPackage.script.id}`));
    console.log(chalk.white(`  Shield:      ${passed ? chalk.green('✓ PASSED') : chalk.yellow('⚠ WARNINGS')}`));
    console.log(chalk.white(`  Tags:        ${(shieldedPackage.metadata?.tags || []).slice(0, 5).join(', ')}`));
    console.log(chalk.gray(`\n  Output saved to ./output/scripts/ and ./output/metadata/`));

    if (shieldedPackage.shieldResults.modifications.length > 0) {
      console.log(chalk.gray(`  Modifications: ${shieldedPackage.shieldResults.modifications.join('; ')}`));
    }

    console.log(chalk.green('\n✅ Content package ready for upload!\n'));

  } catch (err) {
    spinner.fail(`Generation failed: ${err.message}`);
    log.error(err.stack);
  }
}
