/**
 * Layer 4 — Multi-Channel Runner
 * Isolated multi-channel operation engine.
 *
 * Responsibilities:
 *  - Channel profile management (10 isolated identities)
 *  - Master queue: trend → channel assignment logic
 *  - Upload scheduler with optimal timing per timezone
 *  - Digital fingerprint isolation (anti cross-channel detection)
 *  - Upload gap enforcement (anti-spam compliance)
 *  - Channel health monitoring
 *  - Staggered upload execution
 */

export { ChannelManager } from './channel-manager.js';
export { MasterQueue } from './master-queue.js';
export { UploadScheduler } from './upload-scheduler.js';
export { FingerprintRotator } from './fingerprint-rotator.js';
export { ChannelHealthMonitor } from './channel-health-monitor.js';

/**
 * Get the next best channel+opportunity assignment from the queue
 */
export async function getNextAssignment() {
  const { ChannelManager } = await import('./channel-manager.js');
  const { MasterQueue } = await import('./master-queue.js');
  const { UploadScheduler } = await import('./upload-scheduler.js');

  const channels = await ChannelManager.loadAll();
  const readyChannels = await UploadScheduler.getReadyChannels(channels);

  if (readyChannels.length === 0) {
    return null; // All channels are in cooldown
  }

  const nextItem = await MasterQueue.dequeue(readyChannels);
  if (!nextItem) return null;

  return {
    channel: nextItem.channel,
    opportunity: nextItem.opportunity,
    scheduledUploadTime: nextItem.scheduledUploadTime
  };
}
