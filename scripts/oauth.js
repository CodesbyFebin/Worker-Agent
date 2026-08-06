#!/usr/bin/env node
/**
 * OAuth Token Generator
 * Runs an OAuth2 flow for a specific channel and saves the refresh token.
 *
 * Usage: node scripts/oauth.js --channel 01
 */

import { google } from 'googleapis';
import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const args = process.argv.slice(2);
const channelIdx = args.indexOf('--channel');
const channelId = channelIdx >= 0 ? args[channelIdx + 1].padStart(2, '0') : '01';

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('❌ YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log(`\n🔐 OAuth Setup for Channel ${channelId}`);
console.log('\nOpen this URL in the browser for the YouTube channel you want to authorize:');
console.log('\n' + authUrl + '\n');

const app = express();

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.send('❌ No refresh token received. Revoke access at https://myaccount.google.com/permissions and try again.');
      return;
    }

    // Save to .env
    const envPath = path.resolve('.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    const tokenKey = `CHANNEL_${channelId}_REFRESH_TOKEN`;
    if (envContent.includes(tokenKey)) {
      envContent = envContent.replace(new RegExp(`${tokenKey}=.*`), `${tokenKey}=${refreshToken}`);
    } else {
      envContent += `\n${tokenKey}=${refreshToken}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Refresh token saved for Channel ${channelId}`);
    console.log(`   ${tokenKey}=${refreshToken.slice(0, 20)}...`);

    res.send(`<h2>✅ Channel ${channelId} authorized!</h2><p>Refresh token saved to .env. You can close this tab.</p>`);
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('OAuth error:', err.message);
    res.send('❌ OAuth failed: ' + err.message);
  }
});

const server = createServer(app);
server.listen(3000, () => {
  console.log('Waiting for authorization callback on http://localhost:3000...\n');
});
