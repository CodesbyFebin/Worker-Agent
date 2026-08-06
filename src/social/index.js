/**
 * Social Syndication Module — Phase 13
 * Drop-in extension to CC-OS orchestrator.
 *
 * After YouTube upload completes, call:
 *   await runCrosspostCycle(contentPackage, channel)
 *
 * This module handles everything downstream.
 */

export { InstagramWorker } from './workers/instagram.worker.js';
export { FacebookWorker } from './workers/facebook.worker.js';
export { CrosspostExecutor } from './executors/crosspost.executor.js';
export { CaptionGenerator } from './services/caption-generator.js';
export { VideoValidator } from './services/video-validator.js';
export { TokenResolver } from './services/token-resolver.js';
export { MetaRateLimiter } from './services/rate-limiter.js';
export { NotificationService } from './services/notification.service.js';
export { startStaticServer } from './services/static-server.js';

/**
 * Run the full cross-post cycle for a content package
 * Call this after YouTube upload succeeds in the orchestrator
 */
export async function runCrosspostCycle(contentPackage, channel, options = {}) {
  const { CrosspostExecutor } = await import('./executors/crosspost.executor.js');

  const defaultOptions = {
    targetPlatforms: ['instagram', 'facebook'],
    skipStagger: options.skipStagger || false,
    notifyOnComplete: options.notifyOnComplete !== false
  };

  return CrosspostExecutor.execute(contentPackage, channel, defaultOptions);
}
