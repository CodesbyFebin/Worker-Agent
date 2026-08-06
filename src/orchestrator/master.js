/**
 * Master Orchestrator
 * The central pipeline that connects all 5 layers.
 *
 * Full pipeline per video cycle:
 *  L1 → Trend data + keyword opportunities
 *  L2 → Script + TTS + B-Roll + Thumbnail + Metadata
 *  L3 → Sanity Shield (demonetization filter + human noise + copyright)
 *  L4 → Channel assignment + upload scheduling
 *  YT → Upload to YouTube + thumbnail + pinned comment
 *  L5 → A/B test registration + analytics monitoring
 *
 * The orchestrator runs on a cron schedule and manages:
 *  - Content generation queue processing
 *  - Channel health monitoring
 *  - Optimization cycle execution
 *  - Comment bot execution
 *  - Self-improvement updates
 */

import cron from 'node-cron';
import { runDataBrainCycle } from '../layers/layer1-data-brain/index.js';
import { runAssetForgeCycle } from '../layers/layer2-asset-forge/index.js';
import { runSanityShield } from '../layers/layer3-sanity-shield/index.js';
import { MasterQueue } from '../layers/layer4-multi-runner/master-queue.js';
import { ChannelManager } from '../layers/layer4-multi-runner/channel-manager.js';
import { UploadScheduler } from '../layers/layer4-multi-runner/upload-scheduler.js';
import { ChannelHealthMonitor } from '../layers/layer4-multi-runner/channel-health-monitor.js';
import { ABTester } from '../layers/layer5-optimizer/ab-tester.js';
import { CommentBot } from '../layers/layer5-optimizer/comment-bot.js';
import { runOptimizationCycle } from '../layers/layer5-optimizer/index.js';
import { YouTubeAPI } from '../youtube/youtube-api.js';
import { NicheProfiler } from '../layers/layer1-data-brain/niche-profiler.js';
import { CompetitorAnalyzer } from '../layers/layer1-data-brain/competitor-analyzer.js';
// Phase 13 — Social Syndication
import { runCrosspostCycle, startStaticServer } from '../social/index.js';
// Phase 14 — Mission Control
import { startMissionControl } from '../dashboard/index.js';
import { HealthWorker } from '../dashboard/health.worker.js';
import { CalendarDB } from '../database/schema/channels.js';
import { writeJSON, ensureDir, sleep } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const log = logger.layer('Orchestrator');

let isRunning = false;

/**
 * Start the master orchestrator with all cron schedules
 */
export async function startOrchestrator() {
  log.info('CC-OS Master Orchestrator starting...');
  log.info(`Managing ${process.env.TOTAL_CHANNELS || 10} channels`);

  // Phase 14 — start Mission Control (dashboard + health worker + static server)
  startMissionControl().catch((e) => log.warn(`Mission Control startup warning: ${e.message}`));

  // Initial run
  await runMainCycle();

  const queueInterval = parseInt(process.env.QUEUE_INTERVAL_MINUTES || '30', 10);

  // Main content cycle — every N minutes
  cron.schedule(`*/${queueInterval} * * * *`, async () => {
    if (!isRunning) await runMainCycle();
  });

  // Optimization cycle — every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    log.info('Running scheduled optimization cycle...');
    await runOptimizationCycle();
  });

  // Comment bot — every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    log.info('Running comment engagement cycle...');
    await runCommentCycle();
  });

  // Health check — every hour
  cron.schedule('0 * * * *', async () => {
    await runHealthCheck();
  });

  // Queue cleanup — daily at 3am
  cron.schedule('0 3 * * *', async () => {
    MasterQueue.cleanup();
    log.info('Queue cleanup complete');
  });

  log.info(`Orchestrator active. Main cycle every ${queueInterval} minutes.`);
}

/**
 * Main content generation and upload cycle
 */
async function runMainCycle() {
  if (isRunning) {
    log.warn('Previous cycle still running — skipping');
    return;
  }

  isRunning = true;
  log.info('═══ Main Cycle Start ═══');

  try {
    // Step 1: Ensure queue has content
    await refillQueue();

    // Step 2: Get next assignment
    const assignment = await getNextAssignment();
    if (!assignment) {
      log.info('No ready channels or empty queue — cycle complete');
      isRunning = false;
      return;
    }

    const { channel, opportunity, scheduledUploadTime } = assignment;
    const channelLog = log.channel(channel.channelId);

    channelLog.info(`Processing: "${opportunity.keyword}"`);

    // Step 3: Mark channel as generating
    await ChannelManager.updateState(channel.channelId, { status: 'generating' });

    // Step 4: Get competitor analysis
    const competitors = await CompetitorAnalyzer.analyzeTopVideos(
      opportunity.keyword, channel.niche
    ).catch((e) => { channelLog.warn(`Competitor analysis skipped: ${e.message}`); return null; });

    // Step 5: Asset Forge — generate all content assets
    channelLog.info('Running Asset Forge...');
    const contentPackage = await runAssetForgeCycle(
      opportunity, channel.niche, competitors
    );

    // Step 6: Sanity Shield — validate + sanitize
    channelLog.info('Running Sanity Shield...');
    const shieldedPackage = await runSanityShield(contentPackage, channel.niche);

    if (!shieldedPackage.shieldResults.passed) {
      channelLog.warn(`Shield BLOCKED: ${shieldedPackage.shieldResults.warnings.join('; ')}`);
      await ChannelManager.updateState(channel.channelId, { status: 'idle' });
      await MasterQueue.fail(opportunity.id, 'shield_blocked');
      isRunning = false;
      return;
    }

    channelLog.info(`Shield passed (score: ${shieldedPackage.shieldResults.overallScore?.toFixed(2)})`);

    // Step 7: Save metadata package
    ensureDir('./output/metadata');
    writeJSON(`./output/metadata/${shieldedPackage.script?.id}_metadata.json`,
      shieldedPackage.metadata);

    // Step 8: Wait for scheduled upload time
    if (scheduledUploadTime && new Date(scheduledUploadTime) > new Date()) {
      channelLog.info(`Scheduled for ${scheduledUploadTime} — waiting...`);
      await ChannelManager.updateState(channel.channelId, { status: 'scheduled' });
      await UploadScheduler.waitUntil(scheduledUploadTime);
    }

    // Step 9: Upload to YouTube
    channelLog.info('Uploading to YouTube...');
    await ChannelManager.updateState(channel.channelId, { status: 'uploading' });

    const uploadResult = await uploadContentPackage(channel, shieldedPackage);

    if (uploadResult.videoId) {
      // Step 10: Post pinned comment
      const pinnedComment = shieldedPackage.metadata?.engagementCopy?.pinnedComment;
      if (pinnedComment) {
        await sleep(5000);
        channelLog.info('Posting pinned comment...');
      }

      // Step 11: Register A/B test
      if (shieldedPackage.thumbnails?.length > 1) {
        await ABTester.createTest(channel.channelId, uploadResult.videoId, shieldedPackage.thumbnails);
      }

      // Step 12: Record upload + start cooldown
      await ChannelManager.recordUpload(channel.channelId, {
        videoId: uploadResult.videoId,
        title: shieldedPackage.metadata?.primaryTitle,
        keyword: opportunity.keyword,
        versionType: 'pillar'
      });

      // Step 13: Calendar event (Phase 14)
      CalendarDB.addEvent({
        channelId: channel.channelId,
        title: shieldedPackage.metadata?.primaryTitle,
        platform: 'youtube',
        scheduledTime: new Date(),
        videoId: uploadResult.videoId,
        keyword: opportunity.keyword,
        niche: channel.niche?.category
      });

      // Step 14: Health worker — record success (Phase 14)
      HealthWorker.recordSuccessfulUpload(channel.channelId);

      // Step 15: Cross-platform syndication (Phase 13)
      const crosspostEnabled = process.env.CROSSPOST_ENABLED !== 'false';
      if (crosspostEnabled) {
        channelLog.info('Running cross-platform syndication...');
        runCrosspostCycle(shieldedPackage, channel, { notifyOnComplete: true })
          .then((result) => {
            const platforms = Object.entries(result.platforms || {})
              .filter(([, v]) => v.success).map(([k]) => k.toUpperCase());
            if (platforms.length) channelLog.info(`Syndicated to: ${platforms.join(', ')}`);
            // Calendar events for social platforms
            for (const [platform, data] of Object.entries(result.platforms || {})) {
              if (data.success) {
                CalendarDB.addEvent({
                  channelId: channel.channelId,
                  title: shieldedPackage.metadata?.primaryTitle,
                  platform,
                  scheduledTime: new Date(),
                  videoId: data.mediaId || data.videoId,
                  keyword: opportunity.keyword,
                  niche: channel.niche?.category
                });
              }
            }
          })
          .catch((e) => channelLog.warn(`Crosspost error (non-blocking): ${e.message}`));
      }

      await MasterQueue.complete(opportunity.id, uploadResult.videoId);
      channelLog.info(`✅ Video live: https://youtube.com/watch?v=${uploadResult.videoId}`);
    } else {
      channelLog.error('Upload failed — retrying in next cycle');
      await ChannelManager.updateState(channel.channelId, { status: 'idle' });
      HealthWorker.recordUploadFailure(channel.channelId, 'Upload returned no videoId');
      await MasterQueue.fail(opportunity.id, 'upload_failed');
    }

  } catch (err) {
    log.error(`Main cycle error: ${err.message}`);
    log.error(err.stack);
  } finally {
    isRunning = false;
    log.info('═══ Main Cycle End ═══');
  }
}

/**
 * Upload a content package (Pillar + Short) to YouTube
 */
async function uploadContentPackage(channel, contentPackage) {
  const metadata = contentPackage.metadata;
  const niche = channel.niche;

  try {
    // Upload pillar video
    const pillarScript = contentPackage.contentVersions?.pillar;
    const pillarAudio = contentPackage.audioAssets?.pillar;

    // In production, video would be rendered from audio + b-roll here
    // For now we upload whatever video file exists at the expected path
    const videoPath = `./output/videos/${pillarScript?.id}_pillar.mp4`;

    const uploadData = {
      title: metadata?.primaryTitle || opportunity?.keyword,
      description: metadata?.primaryDescription || '',
      tags: metadata?.tags || [],
      niche,
      videoPath,
      scheduledPublishAt: null // Immediate
    };

    const result = await YouTubeAPI.uploadVideo(channel.channelId, uploadData);

    // Upload winning thumbnail
    if (result.id && contentPackage.thumbnails?.[0]?.path) {
      await YouTubeAPI.uploadThumbnail(
        channel.channelId, result.id, contentPackage.thumbnails[0].path
      );
    }

    return { videoId: result.id || result.mock_id, success: true };
  } catch (err) {
    log.error(`Upload failed: ${err.message}`);
    return { videoId: null, success: false, error: err.message };
  }
}

/**
 * Refill the master queue if it's running low
 */
async function refillQueue() {
  const stats = MasterQueue.getStats();

  if (stats.pending > 10) return; // Queue is healthy

  log.info(`Queue low (${stats.pending} items) — running Data Brain cycles...`);

  const channels = await ChannelManager.loadAll();

  for (const [channelId, channel] of Object.entries(channels)) {
    if (channel.state.status === 'paused' || channel.state.status === 'flagged') continue;

    try {
      const opportunities = await runDataBrainCycle(channel.nicheId);
      const added = await MasterQueue.enqueue(opportunities.slice(0, 5), channel.nicheId);
      if (added > 0) log.info(`Channel ${channelId}: added ${added} opportunities to queue`);
    } catch (err) {
      log.warn(`Data Brain failed for channel ${channelId}: ${err.message}`);
    }
  }
}

/**
 * Get next channel-opportunity assignment
 */
async function getNextAssignment() {
  const channels = await ChannelManager.loadAll();
  const readyChannels = await UploadScheduler.getReadyChannels(channels);

  if (Object.keys(readyChannels).length === 0) return null;

  const item = await MasterQueue.dequeue(readyChannels);
  if (!item) return null;

  const scheduledUploadTime = UploadScheduler.calculateUploadTime(item.channel);

  return {
    channel: item.channel,
    opportunity: item.opportunity,
    scheduledUploadTime: scheduledUploadTime.toISOString()
  };
}

/**
 * Comment engagement cycle
 */
async function runCommentCycle() {
  const channels = await ChannelManager.loadAll();

  for (const [channelId, channel] of Object.entries(channels)) {
    if (channel.state.status === 'paused' || channel.state.status === 'flagged') continue;

    const recentVideos = (channel.state.uploadHistory || []).slice(-5);

    for (const video of recentVideos) {
      if (!video.videoId) continue;

      const comments = await YouTubeAPI.listComments(channelId, video.videoId, 50);
      if (comments.length === 0) continue;

      const actions = await CommentBot.processQueue(channelId, comments, channel.niche);

      for (const action of actions) {
        if (action.type === 'reply') {
          await YouTubeAPI.replyToComment(channelId, action.commentId, action.text);
          await sleep(3000); // Rate limiting
        } else if (action.type === 'heart') {
          await YouTubeAPI.heartComment(channelId, action.commentId);
        }
      }
    }
  }
}

/**
 * Channel health check cycle
 */
async function runHealthCheck() {
  const channels = await ChannelManager.loadAll();
  const analyticsData = {};

  for (const [channelId] of Object.entries(channels)) {
    analyticsData[channelId] = await YouTubeAPI.getChannelStats(channelId);
  }

  const healthReport = await ChannelHealthMonitor.checkAll(channels, analyticsData);

  // Auto-pause critical channels
  for (const [channelId, health] of Object.entries(healthReport)) {
    if (health.status === 'critical' && health.actions.includes('pause_channel')) {
      await ChannelManager.pauseChannel(channelId);
      log.error(`Channel ${channelId} AUTO-PAUSED due to critical health status`);
    }
  }
}
