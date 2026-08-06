/**
 * Mission Control Dashboard Server — Phase 14
 * HTTP server + SSE real-time updates + REST API
 * Runs on DASHBOARD_PORT (default 4002)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChannelHealthDB, CalendarDB, AuditLogDB, SocialMetricsDB, runMigration } from '../database/schema/channels.js';
import { ChannelManager } from '../layers/layer4-multi-runner/channel-manager.js';
import { MasterQueue } from '../layers/layer4-multi-runner/master-queue.js';
import { ABTester } from '../layers/layer5-optimizer/ab-tester.js';
import { BulkDispatcher, dispatchEvents } from './bulk-dispatcher.js';
import { TokenResolver } from '../social/services/token-resolver.js';
import { MetaRateLimiter } from '../social/services/rate-limiter.js';
import { CrosspostExecutor } from '../social/executors/crosspost.executor.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.layer('DashboardServer');

const PORT = parseInt(process.env.DASHBOARD_PORT || '4002', 10);

// SSE client registry for real-time push
const sseClients = new Set();

export function startDashboardServer() {
  runMigration();
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(MetaRateLimiter.middleware());
  app.use(express.static(path.join(__dirname, 'public')));

  // ── SSE stream ────────────────────────────────────────────────────────────
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  // Push events to all SSE clients
  dispatchEvents.on('batch:start',    (d) => pushSSE('batch:start', d));
  dispatchEvents.on('channel:complete',(d) => pushSSE('channel:complete', d));
  dispatchEvents.on('channel:error',  (d) => pushSSE('channel:error', d));
  dispatchEvents.on('batch:complete', (d) => pushSSE('batch:complete', d));

  // ── Health API ────────────────────────────────────────────────────────────
  app.get('/api/health', async (req, res) => {
    try {
      const summary = ChannelHealthDB.getSummary();
      const all = ChannelHealthDB.getAll();
      res.json({ summary, channels: all });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/health/:channelId', (req, res) => {
    const data = ChannelHealthDB.get(req.params.channelId.padStart(2, '0'));
    res.json(data);
  });

  // ── Channel API ───────────────────────────────────────────────────────────
  app.get('/api/channels', async (req, res) => {
    try {
      const summary = await ChannelManager.getSummary();
      const health = ChannelHealthDB.getAll();
      const result = summary.map((ch) => ({
        ...ch,
        health: health[ch.channelId] || null,
        platforms: TokenResolver.getAvailablePlatforms(ch.channelId)
      }));
      res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/channels/:id/pause', async (req, res) => {
    await ChannelManager.pauseChannel(req.params.id.padStart(2, '0'));
    AuditLogDB.append({ action: 'MANUAL_PAUSE', channelId: req.params.id });
    res.json({ success: true });
  });

  app.post('/api/channels/:id/resume', async (req, res) => {
    await ChannelManager.resumeChannel(req.params.id.padStart(2, '0'));
    AuditLogDB.append({ action: 'MANUAL_RESUME', channelId: req.params.id });
    res.json({ success: true });
  });

  // ── Calendar API ──────────────────────────────────────────────────────────
  app.get('/api/calendar', (req, res) => {
    const { start, end, channelId } = req.query;
    const startDate = start || new Date(Date.now() - 7 * 86400000).toISOString();
    const endDate   = end   || new Date(Date.now() + 7 * 86400000).toISOString();
    const events = CalendarDB.getRange(startDate, endDate, channelId || null);
    res.json(events);
  });

  app.patch('/api/calendar/:id/reschedule', (req, res) => {
    const { scheduledTime } = req.body;
    if (!scheduledTime) return res.status(400).json({ error: 'scheduledTime required' });
    const updated = CalendarDB.reschedule(req.params.id, scheduledTime);
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    pushSSE('calendar:rescheduled', updated);
    res.json(updated);
  });

  app.delete('/api/calendar/:id', (req, res) => {
    const updated = CalendarDB.updateEvent(req.params.id, { status: 'cancelled' });
    res.json(updated || { error: 'not found' });
  });

  // ── Queue API ─────────────────────────────────────────────────────────────
  app.get('/api/queue', (req, res) => {
    res.json(MasterQueue.getStats());
  });

  // ── A/B Test API ──────────────────────────────────────────────────────────
  app.get('/api/ab-tests', (req, res) => {
    const days = parseInt(req.query.days || '7', 10);
    res.json(ABTester.getResolvedInsights(days));
  });

  // ── Social Metrics API ────────────────────────────────────────────────────
  app.get('/api/metrics/:channelId', (req, res) => {
    const days = parseInt(req.query.days || '30', 10);
    const totals = SocialMetricsDB.getChannelTotals(req.params.channelId, days);
    res.json(totals);
  });

  app.get('/api/crosspost/:channelId', (req, res) => {
    const days = parseInt(req.query.days || '7', 10);
    const history = CrosspostExecutor.getHistory(req.params.channelId, days);
    res.json(history);
  });

  // ── Bulk Dispatch API ─────────────────────────────────────────────────────
  app.post('/api/bulk-dispatch', async (req, res) => {
    try {
      const result = await BulkDispatcher.dispatch(req.body);
      res.json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/bulk-dispatch/history', (req, res) => {
    res.json(BulkDispatcher.getBatchHistory(20));
  });

  // ── Token Vault API ───────────────────────────────────────────────────────
  app.get('/api/vault', (req, res) => {
    res.json(TokenResolver.getVaultSummary());
  });

  app.post('/api/vault/rotate', (req, res) => {
    const { channelId, platform, token, extraData } = req.body;
    if (!channelId || !platform || !token)
      return res.status(400).json({ error: 'channelId, platform, token required' });
    TokenResolver.rotateToken(channelId, platform, token, extraData || {});
    AuditLogDB.append({ action: 'ROTATE_TOKEN', channelId, platform });
    res.json({ success: true });
  });

  // ── Audit Log API ─────────────────────────────────────────────────────────
  app.get('/api/audit', (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    res.json(AuditLogDB.getRecent(limit));
  });

  // ── Serve dashboard UI ────────────────────────────────────────────────────
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    log.info(`Mission Control dashboard running → http://localhost:${PORT}`);
  });

  return app;
}

function pushSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
}
