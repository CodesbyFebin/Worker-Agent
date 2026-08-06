/**
 * Static File Server
 * Serves ./output/ directory over HTTP so Meta Graph API can fetch video files.
 * Runs on a separate port (STATIC_PORT, default 4001).
 *
 * Meta's Graph API requires a publicly accessible URL for video_url parameter.
 * In local dev: use ngrok or expose port 4001 via STATIC_SERVER_URL in .env.
 * In production: replace with signed S3/CloudFront URLs.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../../utils/logger.js';

const log = logger.layer('StaticServer');

let serverInstance = null;

export function startStaticServer() {
  if (serverInstance) return serverInstance;

  const PORT = parseInt(process.env.STATIC_PORT || '4001', 10);
  const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './output');

  const app = express();

  // Rate limiting for static files (prevent abuse)
  const requestCounts = new Map();
  app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const count = requestCounts.get(ip) || { count: 0, reset: now + 60000 };

    if (now > count.reset) {
      count.count = 0;
      count.reset = now + 60000;
    }

    count.count++;
    requestCounts.set(ip, count);

    if (count.count > 100) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    next();
  });

  // Only serve video files (no directory listing)
  app.get('/output/:filename', (req, res) => {
    const filename = path.basename(req.params.filename); // Prevent path traversal
    const filePath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.sendFile(filePath);
  });

  // Serve social output subdir
  app.get('/output/social/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(OUTPUT_DIR, 'social', filename);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.sendFile(filePath);
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

  serverInstance = app.listen(PORT, () => {
    log.info(`Static server running on port ${PORT}`);
    if (!process.env.STATIC_SERVER_URL) {
      log.warn('STATIC_SERVER_URL not set in .env — Meta APIs may not reach local files');
      log.warn('For production, set STATIC_SERVER_URL to your public domain or ngrok URL');
    }
  });

  return serverInstance;
}

export function stopStaticServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
    log.info('Static server stopped');
  }
}
