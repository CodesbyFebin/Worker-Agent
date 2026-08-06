/**
 * CC-OS Logger
 * Winston-based logging with channel-aware context
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_DIR = process.env.LOG_DIR || './logs';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp, channelId, layer, ...meta }) => {
  const channelTag = channelId ? chalk_channel(channelId) : '';
  const layerTag = layer ? ` [${layer}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level.toUpperCase().padEnd(7)}${channelTag}${layerTag} ${message}${metaStr}`;
});

function chalk_channel(id) {
  const colors = ['36', '32', '33', '35', '34', '31', '36', '32', '33', '35'];
  const colorCode = colors[(parseInt(id, 10) - 1) % colors.length];
  return ` \x1b[${colorCode}m[CH${String(id).padStart(2, '0')}]\x1b[0m`;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    // Console output
    new winston.transports.Console({
      format: combine(
        colorize({ all: false }),
        timestamp({ format: 'HH:mm:ss' }),
        customFormat
      )
    }),
    // Main log file
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'ccos.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Error-only file
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Channel-specific child loggers
logger.channel = (channelId) => logger.child({ channelId });
logger.layer = (layerName) => logger.child({ layer: layerName });

export default logger;
