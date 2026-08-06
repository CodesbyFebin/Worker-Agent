/**
 * Notification Service
 * Sends alerts to Discord/Telegram/Slack when events occur.
 * Used by: crosspost executor, health monitor, rapid pivot.
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

const log = logger.layer('Notifications');

export class NotificationService {

  static async send({ type, channelId, message, data = {} }) {
    const results = await Promise.allSettled([
      NotificationService.sendDiscord(message, type, channelId),
      NotificationService.sendTelegram(message, type)
    ]);

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    if (sent > 0) log.info(`Notification sent (${sent} channels): ${message.slice(0, 80)}`);
    return sent > 0;
  }

  static async sendDiscord(message, type, channelId) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const colors = {
      crosspost_complete: 0x00ff00,
      health_critical: 0xff0000,
      health_warning: 0xffaa00,
      rapid_pivot: 0xff6600,
      default: 0x0099ff
    };

    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: `CC-OS Alert${channelId ? ` — Channel ${channelId}` : ''}`,
          description: message,
          color: colors[type] || colors.default,
          timestamp: new Date().toISOString(),
          footer: { text: 'CC-OS Notification System' }
        }]
      }, { timeout: 8000 });
      return true;
    } catch (err) {
      log.debug(`Discord notification failed: ${err.message}`);
      return false;
    }
  }

  static async sendTelegram(message, type) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return false;

    const emoji = {
      crosspost_complete: '✅',
      health_critical: '🚨',
      health_warning: '⚠️',
      rapid_pivot: '🔄',
      default: '📢'
    }[type] || '📢';

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: `${emoji} *CC-OS*\n${message}`,
        parse_mode: 'Markdown'
      }, { timeout: 8000 });
      return true;
    } catch (err) {
      log.debug(`Telegram notification failed: ${err.message}`);
      return false;
    }
  }
}
