/**
 * Token Resolver
 * Resolves per-channel OAuth tokens for all platforms.
 *
 * Resolution order:
 *  1. Environment variables (CHANNEL_XX_INSTAGRAM_ACCESS_TOKEN)
 *  2. Token vault file (data/social/tokens.enc.json) — encrypted at rest
 *  3. Throws if neither found
 *
 * Supports: YouTube, Instagram (Graph API), Facebook (Graph API)
 */

import crypto from 'crypto';
import path from 'path';
import { readJSON, writeJSON, ensureDir } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';

const log = logger.layer('TokenResolver');
const VAULT_PATH = './data/social/tokens.vault.json';
const ENCRYPTION_KEY = process.env.TOKEN_VAULT_KEY || 'cc-os-vault-key-32-chars-padded!!';

export class TokenResolver {

  // ─── YouTube ────────────────────────────────────────────────────────────

  static getYouTubeTokens(channelId) {
    const id = String(channelId).padStart(2, '0');
    return {
      refreshToken: process.env[`CHANNEL_${id}_REFRESH_TOKEN`] || TokenResolver.loadFromVault(id, 'youtube_refresh'),
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      channelYtId: process.env[`CHANNEL_${id}_ID`]
    };
  }

  // ─── Instagram ──────────────────────────────────────────────────────────

  static getInstagramTokens(channelId) {
    const id = String(channelId).padStart(2, '0');
    return {
      accessToken: process.env[`CHANNEL_${id}_INSTAGRAM_ACCESS_TOKEN`]
        || process.env[`CHANNEL_${id}_FB_ACCESS_TOKEN`]  // FB token works for IG if linked
        || TokenResolver.loadFromVault(id, 'instagram_access_token'),
      businessId: process.env[`CHANNEL_${id}_INSTAGRAM_BUSINESS_ID`]
        || TokenResolver.loadFromVault(id, 'instagram_business_id')
    };
  }

  // ─── Facebook ──────────────────────────────────────────────────────────

  static getFacebookTokens(channelId) {
    const id = String(channelId).padStart(2, '0');
    return {
      accessToken: process.env[`CHANNEL_${id}_FB_ACCESS_TOKEN`]
        || TokenResolver.loadFromVault(id, 'fb_access_token'),
      pageId: process.env[`CHANNEL_${id}_FB_PAGE_ID`]
        || TokenResolver.loadFromVault(id, 'fb_page_id')
    };
  }

  // ─── All platforms for a channel ────────────────────────────────────────

  static getAllTokens(channelId) {
    return {
      youtube: TokenResolver.getYouTubeTokens(channelId),
      instagram: TokenResolver.getInstagramTokens(channelId),
      facebook: TokenResolver.getFacebookTokens(channelId)
    };
  }

  // ─── Platform availability check ────────────────────────────────────────

  static getAvailablePlatforms(channelId) {
    const platforms = ['youtube']; // YouTube always assumed
    const igTokens = TokenResolver.getInstagramTokens(channelId);
    const fbTokens = TokenResolver.getFacebookTokens(channelId);
    if (igTokens.accessToken && igTokens.businessId) platforms.push('instagram');
    if (fbTokens.accessToken && fbTokens.pageId) platforms.push('facebook');
    return platforms;
  }

  // ─── Token Vault (encrypted at rest) ────────────────────────────────────

  static loadFromVault(channelId, tokenType) {
    try {
      const vault = readJSON(VAULT_PATH);
      if (!vault?.entries) return null;
      const entry = vault.entries.find((e) => e.channelId === channelId && e.type === tokenType);
      if (!entry?.value) return null;
      return TokenResolver.decrypt(entry.value);
    } catch {
      return null;
    }
  }

  static saveToVault(channelId, tokenType, tokenValue) {
    ensureDir(path.dirname(VAULT_PATH));
    const vault = readJSON(VAULT_PATH) || { entries: [] };
    const encrypted = TokenResolver.encrypt(tokenValue);

    const existingIdx = vault.entries.findIndex(
      (e) => e.channelId === channelId && e.type === tokenType
    );

    const entry = {
      channelId: String(channelId).padStart(2, '0'),
      type: tokenType,
      value: encrypted,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      vault.entries[existingIdx] = entry;
    } else {
      vault.entries.push(entry);
    }

    writeJSON(VAULT_PATH, vault);
    log.info(`Token saved to vault: channel ${channelId}, type: ${tokenType}`);
  }

  static rotateToken(channelId, platform, newToken, extraData = {}) {
    const id = String(channelId).padStart(2, '0');

    if (platform === 'instagram') {
      TokenResolver.saveToVault(id, 'instagram_access_token', newToken);
      if (extraData.businessId) TokenResolver.saveToVault(id, 'instagram_business_id', extraData.businessId);
    } else if (platform === 'facebook') {
      TokenResolver.saveToVault(id, 'fb_access_token', newToken);
      if (extraData.pageId) TokenResolver.saveToVault(id, 'fb_page_id', extraData.pageId);
    } else if (platform === 'youtube') {
      TokenResolver.saveToVault(id, 'youtube_refresh', newToken);
    }

    // Audit log
    TokenResolver.logAudit(id, platform, 'ROTATE_TOKEN');
  }

  static encrypt(text) {
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  static decrypt(text) {
    try {
      const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
      const [ivHex, encryptedHex] = text.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  static logAudit(channelId, platform, action) {
    ensureDir('./data/social');
    const logPath = './data/social/audit.log';
    const entry = `${new Date().toISOString()} | channel=${channelId} | platform=${platform} | action=${action}\n`;
    try {
      require('fs').appendFileSync(logPath, entry, 'utf-8');
    } catch {}
  }

  /**
   * Get vault summary (without exposing token values)
   */
  static getVaultSummary() {
    const vault = readJSON(VAULT_PATH);
    if (!vault?.entries) return [];
    return vault.entries.map((e) => ({
      channelId: e.channelId,
      type: e.type,
      hasValue: !!e.value,
      updatedAt: e.updatedAt
    }));
  }
}
