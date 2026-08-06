/**
 * Master Queue
 *
 * The central nervous system for content distribution across 10 channels.
 *
 * Queue logic:
 *  1. Receives content opportunities from Layer 1 (Data Brain)
 *  2. Scores and ranks opportunities by potential impact
 *  3. Assigns each opportunity to the optimal available channel
 *  4. Balances upload load across channels (no channel dominates)
 *  5. Prevents niche collision (same topic across channels simultaneously)
 *  6. Tracks queue depth and auto-generates more content when low
 *
 * Assignment algorithm:
 *  - Prioritize channel with lowest recent upload count
 *  - Match opportunity niche to channel niche profile
 *  - Apply "trend urgency" — high-velocity trends jump the queue
 */

import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import { ChannelManager } from './channel-manager.js';
import logger from '../../utils/logger.js';

const log = logger.layer('MasterQueue');
const QUEUE_PATH = './data/trends/master-queue.json';
const MIN_QUEUE_DEPTH = 5; // Alert if queue drops below this

export class MasterQueue {

  /**
   * Add content opportunities to the queue
   */
  static async enqueue(opportunities, sourceNicheId) {
    ensureDir(path.dirname(QUEUE_PATH));
    const queue = MasterQueue.load();

    let added = 0;
    for (const opp of opportunities) {
      // Skip if already in queue (same keyword)
      const isDuplicate = queue.items.some(
        (item) => item.keyword?.toLowerCase() === opp.keyword?.toLowerCase()
      );
      if (isDuplicate) continue;

      queue.items.push({
        id: uuidv4(),
        keyword: opp.keyword,
        opportunityScore: opp.opportunityScore || 0.5,
        trendVelocity: opp.trendVelocity || 0.5,
        predictedPeakHours: opp.predictedPeakHours || 48,
        microNodes: opp.microNodes || [],
        sourceNicheId,
        status: 'pending',
        assignedChannelId: null,
        enqueuedAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + (opp.predictedPeakHours || 48) * 60 * 60 * 1000
        ).toISOString()
      });
      added++;
    }

    // Sort by opportunity score (descending) + trend urgency
    queue.items.sort((a, b) => {
      const urgencyA = a.trendVelocity * (1 / Math.max(a.predictedPeakHours, 1)) * 100;
      const urgencyB = b.trendVelocity * (1 / Math.max(b.predictedPeakHours, 1)) * 100;
      return (b.opportunityScore + urgencyB * 0.3) - (a.opportunityScore + urgencyA * 0.3);
    });

    MasterQueue.save(queue);
    log.info(`Enqueued ${added} opportunities. Queue depth: ${queue.items.filter((i) => i.status === 'pending').length}`);
    return added;
  }

  /**
   * Dequeue the best opportunity for an available channel
   */
  static async dequeue(readyChannels) {
    const queue = MasterQueue.load();

    // Remove expired items
    const now = new Date();
    queue.items = queue.items.filter(
      (item) => item.status !== 'pending' || new Date(item.expiresAt) > now
    );

    const pending = queue.items.filter((i) => i.status === 'pending');

    if (pending.length === 0) {
      log.warn('Queue is empty — triggering Data Brain cycle');
      return null;
    }

    // Warn on low queue depth
    if (pending.length < MIN_QUEUE_DEPTH) {
      log.warn(`Low queue depth: ${pending.length} items remaining`);
    }

    // Find best channel-opportunity pairing
    const assignment = MasterQueue.findBestAssignment(pending, readyChannels);

    if (!assignment) {
      log.warn('No suitable channel-opportunity pairing found');
      return null;
    }

    // Mark as assigned
    const item = queue.items.find((i) => i.id === assignment.opportunity.id);
    if (item) {
      item.status = 'assigned';
      item.assignedChannelId = assignment.channel.channelId;
      item.assignedAt = new Date().toISOString();
    }

    MasterQueue.save(queue);

    log.info(`Assigned "${assignment.opportunity.keyword}" → Channel ${assignment.channel.channelId}`);
    return assignment;
  }

  /**
   * Mark a queue item as completed (video uploaded)
   */
  static async complete(queueItemId, videoId) {
    const queue = MasterQueue.load();
    const item = queue.items.find((i) => i.id === queueItemId);

    if (item) {
      item.status = 'completed';
      item.videoId = videoId;
      item.completedAt = new Date().toISOString();
    }

    MasterQueue.save(queue);
  }

  /**
   * Mark a queue item as failed (will retry)
   */
  static async fail(queueItemId, reason) {
    const queue = MasterQueue.load();
    const item = queue.items.find((i) => i.id === queueItemId);

    if (item) {
      item.retryCount = (item.retryCount || 0) + 1;

      if (item.retryCount >= 3) {
        item.status = 'failed';
        item.failReason = reason;
      } else {
        // Re-queue with slightly lower priority
        item.status = 'pending';
        item.assignedChannelId = null;
        item.opportunityScore = item.opportunityScore * 0.8;
        log.warn(`Queue item retrying (attempt ${item.retryCount}): "${item.keyword}"`);
      }
    }

    MasterQueue.save(queue);
  }

  /**
   * Find the optimal channel-opportunity pairing
   *
   * Scoring factors:
   *  1. Niche alignment (channel niche matches opportunity niche)
   *  2. Channel upload frequency (prefer channels with fewer recent uploads)
   *  3. Niche collision prevention (don't assign same topic to 2 channels simultaneously)
   */
  static findBestAssignment(pendingItems, readyChannels) {
    let bestScore = -1;
    let bestPairing = null;

    // Topics currently being processed (prevent niche collision)
    const queue = MasterQueue.load();
    const activeTopics = queue.items
      .filter((i) => i.status === 'assigned')
      .map((i) => i.keyword?.toLowerCase());

    for (const opportunity of pendingItems.slice(0, 20)) {
      // Skip if topic is already being processed
      const hasCollision = activeTopics.some(
        (topic) => topic && opportunity.keyword &&
          MasterQueue.topicSimilarity(topic, opportunity.keyword) > 0.6
      );
      if (hasCollision) continue;

      for (const channel of Object.values(readyChannels)) {
        const score = MasterQueue.scorePairing(opportunity, channel);

        if (score > bestScore) {
          bestScore = score;
          bestPairing = { opportunity, channel };
        }
      }
    }

    return bestPairing;
  }

  /**
   * Score a channel-opportunity pairing (0-1)
   */
  static scorePairing(opportunity, channel) {
    let score = 0;

    // Niche alignment (strongest signal)
    const nicheMatch = opportunity.sourceNicheId === channel.nicheId ||
      channel.niche?.category === opportunity.sourceNicheId;
    if (nicheMatch) score += 0.5;

    // Micro-node overlap
    const channelNodes = new Set(channel.niche?.microNodes || []);
    const oppNodes = opportunity.microNodes || [];
    const nodeOverlap = oppNodes.filter((n) => channelNodes.has(n)).length / Math.max(oppNodes.length, 1);
    score += nodeOverlap * 0.2;

    // Upload frequency balance (prefer least-uploaded channel)
    const weeklyUploads = ChannelManager.countRecentUploads(channel.state, 7);
    const maxWeekly = parseInt(process.env.MAX_VIDEOS_PER_DAY || '3', 10) * 7;
    const loadScore = 1 - (weeklyUploads / maxWeekly);
    score += loadScore * 0.2;

    // Trend urgency bonus
    if (opportunity.predictedPeakHours < 24) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Simple topic similarity check (Jaccard on words)
   */
  static topicSimilarity(topicA, topicB) {
    const wordsA = new Set(topicA.toLowerCase().split(/\s+/));
    const wordsB = new Set(topicB.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
  }

  /**
   * Get queue statistics
   */
  static getStats() {
    const queue = MasterQueue.load();
    const now = new Date();

    const stats = {
      total: queue.items.length,
      pending: 0,
      assigned: 0,
      completed: 0,
      failed: 0,
      expired: 0,
      avgOpportunityScore: 0,
      topKeywords: []
    };

    for (const item of queue.items) {
      if (item.status === 'pending' && new Date(item.expiresAt) <= now) {
        stats.expired++;
      } else {
        stats[item.status] = (stats[item.status] || 0) + 1;
      }
    }

    const pending = queue.items.filter((i) => i.status === 'pending');
    if (pending.length > 0) {
      stats.avgOpportunityScore = pending.reduce((s, i) => s + (i.opportunityScore || 0), 0) / pending.length;
      stats.topKeywords = pending.slice(0, 5).map((i) => i.keyword);
    }

    return stats;
  }

  static load() {
    ensureDir(path.dirname(QUEUE_PATH));
    return readJSON(QUEUE_PATH) || { items: [], lastUpdated: new Date().toISOString() };
  }

  static save(queue) {
    writeJSON(QUEUE_PATH, { ...queue, lastUpdated: new Date().toISOString() });
  }

  /**
   * Clear completed/failed/expired items (maintenance)
   */
  static cleanup() {
    const queue = MasterQueue.load();
    const before = queue.items.length;
    const now = new Date();

    queue.items = queue.items.filter((item) => {
      if (item.status === 'completed') return false;
      if (item.status === 'failed') return false;
      if (item.status === 'pending' && new Date(item.expiresAt) <= now) return false;
      return true;
    });

    MasterQueue.save(queue);
    log.info(`Queue cleanup: removed ${before - queue.items.length} items`);
  }
}
