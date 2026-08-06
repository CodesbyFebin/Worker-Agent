# CC-OS — Content Creator Operating System

A production-grade YouTube automation engine that manages **10 channels simultaneously** with AI-powered trend prediction, script generation, voice synthesis, thumbnail creation, compliance checking, and self-optimizing analytics.

---

## Architecture: The 5-Layer Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    MASTER ORCHESTRATOR                        │
│              (cron scheduler + pipeline runner)               │
└───────────┬──────────────────────────────────────────────────┘
            │
    ┌───────▼────────┐    Every 30 min
    │  LAYER 1       │    Trend scraping, keyword prediction,
    │  Data Brain    │    sentiment scoring, niche profiling
    └───────┬────────┘
            │
    ┌───────▼────────┐    Per opportunity
    │  LAYER 2       │    Script (DSA), TTS (ElevenLabs),
    │  Asset Forge   │    B-Roll, Thumbnails, Metadata
    └───────┬────────┘
            │
    ┌───────▼────────┐    Mandatory gate
    │  LAYER 3       │    Demonetization filter, Human noise,
    │  Sanity Shield │    Copyright scan, Policy check
    └───────┬────────┘
            │
    ┌───────▼────────┐    Assignment + scheduling
    │  LAYER 4       │    Channel manager, Master queue,
    │  Multi-Runner  │    Upload scheduler, Fingerprints
    └───────┬────────┘
            │
    ┌───────▼────────┐    Post-upload
    │  LAYER 5       │    A/B testing, Retention analysis,
    │  Optimizer     │    Rapid Pivot, Comment bot
    └────────────────┘
```

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Fill in your API keys
node scripts/setup.js
```

### 3. Authorize YouTube Channels

```bash
# Run for each channel (01-10)
node scripts/oauth.js --channel 01
node scripts/oauth.js --channel 02
# ... etc
```

### 4. Customize Niche Profiles

Edit `data/niches/channel_01.json` through `channel_10.json`.
Each profile controls: tone, voice, keywords, upload schedule, persona.

### 5. Test Generation

```bash
node src/index.js generate --channel 1
# Or force a specific topic:
node src/index.js generate --channel 1 --topic "best AI tools 2026"
```

### 6. Start the Orchestrator

```bash
node src/index.js start
```

### 7. Monitor

```bash
node src/index.js dashboard
```

---

## Commands

| Command | Description |
|---|---|
| `node src/index.js start` | Start master orchestrator (continuous) |
| `node src/index.js dashboard` | Live channel dashboard |
| `node src/index.js generate --channel N` | Generate content for channel N |
| `node src/index.js generate --topic "X"` | Force specific topic |
| `node src/index.js analyze --days 7` | Performance analysis |
| `node src/index.js optimize` | Run optimization cycle manually |
| `node src/index.js setup` | Show setup instructions |

---

## Required API Keys

| Service | Purpose | Free Tier |
|---|---|---|
| **OpenAI** | Script generation, keyword expansion | Yes (limited) |
| **ElevenLabs** | Text-to-speech audio | Yes (10k chars/mo) |
| **Google OAuth** | YouTube upload & analytics | Free |
| **Pexels** | Stock video/photo B-Roll | Yes (unlimited) |
| **SerpAPI** | Google Trends scraping | 100 free/mo |
| **RapidAPI** | YouTube autocomplete + search | Free tier |

---

## The 5-Layer System Explained

### Layer 1 — Data Brain

- **Trend Scraper**: Monitors Google Trends, YouTube autocomplete, Reddit hot posts simultaneously. Velocity-scores each trend to predict when it will peak (72-hour window).
- **Keyword Predictor**: AI-expands seed keywords into full content opportunity lists with search intent classification and monetization scoring.
- **Sentiment Analyzer**: Scores every keyword for emotion (curiosity, urgency, fear, excitement) and demonetization risk before generation begins.
- **Niche Profiler**: Manages 10 distinct channel personas — each with unique voice, tone, upload schedule, and content angle.
- **Micro-Node Tagger**: Tags content with viewer cohort intersection nodes so the YouTube algorithm surfaces it to multiple audience segments simultaneously.

### Layer 2 — Asset Forge

- **Script Generator (DSA)**: Builds scripts with retention hooks injected every 7 seconds of speech. Each script includes B-Roll cue markers, emotion modulation tags, and Easter Egg re-watch phrases.
- **TTS Adapter**: Sends each script segment to ElevenLabs with per-segment emotion settings (stability, style, similarity_boost). Slower for suspense, faster for urgency — automatically.
- **B-Roll Matcher**: Extracts action verbs from script text and fetches semantically matched stock footage from Pexels. Applies the 80/20 rule: 80% stock + 20% unique data overlays.
- **Thumbnail Engine**: Generates 2 A/B variants per video with high-contrast color schemes, emotion-matched text, and attention scoring vs competitor thumbnails.
- **Content Splitter**: Splits every Pillar script into 3 formats — Pillar (15min), Snippet (5min), Short (55sec) — implementing the Traffic Tornado strategy.

### Layer 3 — Sanity Shield

- **Demonetization Filter**: 200+ term replacement map with AI-powered contextual rewriting for ambiguous phrases. Scores every video's ad-friendliness before upload.
- **Human Noise Injector**: Defeats AI-detection by injecting contractions, filler words, personal anecdotes (from a channel Memory Bank), rhetorical questions, and sentence rhythm variation. Scores each script's human-ness 0-1.
- **Copyright Scanner**: Checks for trademark mentions, lyric fragments, and B-Roll license issues. Risk levels: low/medium/high.
- **Policy Guard**: Full YouTube ToS compliance check — health misinformation, COPPA, AI disclosure requirements, repetitive content pattern detection.
- **Uniqueness Checker**: TF cosine similarity against a rolling 20-video history per channel. Blocks uploads that are >80% similar to recent content.

### Layer 4 — Multi-Channel Runner

- **Channel Manager**: 10-channel state machine (idle → generating → uploading → cooldown → paused/flagged). Per-channel OAuth token isolation.
- **Master Queue**: Priority queue with trend-urgency scoring. Prevents niche collision (same topic on two channels simultaneously). Jaccard similarity-based deduplication.
- **Upload Scheduler**: Timezone-aware optimal upload timing. Staggered channel offsets (Channel 01 at :00, 02 at :18, 03 at :36...). No two channels upload within 30 minutes of each other.
- **Fingerprint Rotator**: 10 distinct browser profiles — unique User-Agent, viewport, locale, timezone, interaction delays. Prevents cross-channel detection pattern.
- **Health Monitor**: Tracks CTR, views, like rate, and subscriber deltas vs per-channel baselines. Auto-pauses critical channels. Trend analysis over time.

### Layer 5 — Adaptive Optimizer

- **A/B Tester**: Registers thumbnail/title tests on upload. Resolves after configurable window (default 48h). Declares winner if CTR improvement ≥10% with ≥100 impressions.
- **Retention Analyzer**: Maps YouTube Analytics retention curves to script sections. Identifies drop-off points, re-watch segments, and power zones. Generates section-level recommendations.
- **Self-Improver**: Uses AVD, CTR, and A/B data to update generation parameters per channel. Adjusts video length targets, hook frequency, intro duration, and title style guidance using exponential moving averages.
- **Rapid Pivot Protocol**: Monitors videos at 2-4 hours post-upload. If CTR < 40% of baseline, automatically queues title swap, thumbnail swap, and description refresh via YouTube API.
- **Comment Bot**: NLP-powered reply generation matching each channel's persona. Classifies comments (question/positive/negative/spam) and generates appropriate responses. Rate-limited to 20 replies/hour.

---

## Niche Profile Configuration

Each channel's behavior is entirely controlled by its `data/niches/channel_XX.json` file:

```json
{
  "id": "channel_01",
  "channelName": "Your Channel Name",
  "category": "technology",
  "tone": "conversational",
  "voiceGender": "male",
  "energyLevel": "high",
  "seedKeywords": ["ai tools", "productivity", "tech review"],
  "microNodes": ["tech", "productivity", "ai", "minimalism"],
  "targetTimezone": "America/New_York",
  "optimalUploadHour": 15,
  "uploadDaysOfWeek": [1, 3, 5],
  "channelPersona": {
    "backstory": "A tech professional sharing AI workflows",
    "catchphrases": ["here's the thing", "and that's the game changer"],
    "quirks": ["backs claims with data", "references personal experiments"]
  }
}
```

---

## The Traffic Tornado Strategy

Every Pillar video generates 3 upload assets:

```
Pillar (15min) ──→ Deep-dive, watch hours, AdSense revenue
    ↓
Snippet (5min) ──→ Repurposed to secondary channel or Clips
    ↓  
Short (55sec) ───→ YouTube Shorts, pinned comment links to Pillar
    ↓
Traffic Funnel: Shorts → New subscribers → Watch Pillar → Watch Hours → Monetization
```

---

## White-Hat Compliance

Every technique in CC-OS complies with YouTube's Terms of Service:

| Technique | How It's White-Hat |
|---|---|
| Human Noise Injection | Improves content quality, not deceptive |
| Multi-Channel Fingerprints | Separate accounts, each with own OAuth |
| Staggered Uploads | Mimics natural creator behavior |
| Rapid Pivot Protocol | Title/thumbnail updates via official API |
| Comment Bot | Genuine AI-generated replies, not spam |
| Micro-Node Tagging | Accurate content categorization |

---

## 6-Month Launch Roadmap

| Month | Goal | Focus |
|---|---|---|
| 1 | Prototype | 1 channel, manual oversight, test generation quality |
| 2 | Framework | Move to orchestrator, connect YouTube API |
| 3 | Network | Clone to 10 channels, set distinct niche profiles |
| 4 | Optimize | Activate A/B testing, feed retention data back |
| 5 | Scale | Comment bot live, trend predictor tuned |
| 6 | Harvest | 3-5 videos/channel/week, all channels monetized |

---

## File Structure

```
src/
├── index.js                    # CLI entry point
├── orchestrator/
│   └── master.js               # Main pipeline scheduler
├── layers/
│   ├── layer1-data-brain/      # Trend + keyword intelligence
│   ├── layer2-asset-forge/     # Content generation
│   ├── layer3-sanity-shield/   # Compliance + humanization
│   ├── layer4-multi-runner/    # Channel management
│   └── layer5-optimizer/       # A/B + self-improvement
├── youtube/
│   └── youtube-api.js          # YouTube Data API v3 client
├── cli/
│   ├── dashboard.js            # Live status dashboard
│   ├── generate.js             # Manual generation command
│   ├── analyze.js              # Performance analysis
│   └── setup.js                # Setup wizard
└── utils/
    ├── logger.js               # Channel-aware logging
    └── helpers.js              # Shared utilities

data/
├── niches/                     # 10 channel niche profiles
├── trends/                     # Master queue + trend cache
├── ab-tests/                   # A/B test records
├── analytics/                  # Channel analytics + health
└── prompt-history/             # Self-improver parameters

output/
├── scripts/                    # Generated JSON scripts
├── audio/                      # TTS audio files
├── thumbnails/                 # Generated thumbnail images
├── videos/                     # Rendered video files
└── metadata/                   # SEO metadata packages

scripts/
├── setup.js                    # Project initialization
└── oauth.js                    # YouTube OAuth flow
```

---

## Environment Variables Reference

See `.env.example` for the complete list. Minimum required to start:

```bash
OPENAI_API_KEY=           # Script generation (required)
ELEVENLABS_API_KEY=       # TTS audio (optional, uses placeholders without)
YOUTUBE_CLIENT_ID=        # YouTube upload (required for upload)
YOUTUBE_CLIENT_SECRET=    # YouTube upload (required for upload)
PEXELS_API_KEY=           # B-Roll footage (optional, uses mock without)
CHANNEL_01_REFRESH_TOKEN= # Per-channel OAuth (required per channel)
CHANNEL_01_ID=            # YouTube channel ID
```

---

*CC-OS — Built for the New Era of Content Creation*

---

## Phase 13 — Cross-Platform Syndication

Every Short video published to YouTube is automatically crossposted to **Instagram Reels** and **Facebook Reels** after upload.

### Setup

```bash
# 1. Get Meta credentials (Facebook Developers → Create App → Graph API)
# 2. Add to .env for each channel:
CHANNEL_01_FB_PAGE_ID=123456789
CHANNEL_01_FB_ACCESS_TOKEN=EAAH...
CHANNEL_01_INSTAGRAM_BUSINESS_ID=987654321
CHANNEL_01_INSTAGRAM_ACCESS_TOKEN=EAAH...

# 3. Set your public URL (or use ngrok for local dev):
STATIC_SERVER_URL=https://your-domain.com   # or http://your-ngrok-url.io
```

### How it works

```
YouTube Upload ✅
     ↓
social.crosspost executor
     ↓
┌────────────────┬────────────────────┐
│  Instagram     │  Facebook          │
│  (immediate)   │  (+15 min stagger) │
│                │                    │
│  • 1080x1920   │  • 1080x1920       │
│  • 30 IG tags  │  • 12 FB tags      │
│  • No YT logo  │  • No YT logo      │
│  • IG overlay  │  • FB overlay      │
└────────────────┴────────────────────┘
```

### White-hat protections enforced automatically

- **Watermark scrub**: FFmpeg blurs the bottom-right corner (YouTube subscribe button area) before upload
- **Aspect ratio**: Forces exactly 1080×1920 — Meta rejects anything else
- **Duration cap**: Hard cut at 58 seconds — Meta's 60s limit with safety buffer
- **Stagger delay**: Facebook always posts 15 minutes after Instagram — prevents spam flags
- **Unique captions**: Different hashtag sets per platform, different CTA copy
- **No TikTok watermarks**: Raw MP4 only — never a TikTok re-download

### New CLI commands

```bash
node src/index.js crosspost --channel 1 --video ./output/videos/my_video.mp4 --topic "AI tools"
node src/index.js start  # crosspost runs automatically after each YouTube upload
```

---

## Phase 14 — Mission Control Dashboard

A full web dashboard for managing all 10 channels from one screen.

### Start

```bash
node src/index.js mission-control   # dashboard only, port 4002
node src/index.js start             # starts everything including dashboard
```

Then open: **http://localhost:4002**

### Dashboard Features

**Channel Command Center**
- Live health status for all 10 channels (Green/Yellow/Orange/Red)
- Subscriber count, 30-day views, estimated revenue per channel
- Platform badges (YT/IG/FB) showing what's configured
- One-click pause/resume per channel
- "⚡ Burst" button to trigger 5 Shorts for any channel immediately

**Content Calendar**
- 10-day calendar view (3 days back, 7 days forward)
- Color-coded events: Red=YouTube, Orange=Instagram, Blue=Facebook
- **Drag-to-reschedule**: drag any event to a new day — updates the DB and reschedules the job
- Shows published ✅, scheduled 🕐, failed ❌ states

**Bulk Publish**
- Select any combination of channels (1-10)
- Choose platforms (YouTube + Instagram + Facebook)
- Enter a topic — the system generates unique content per channel
- Visual variation auto-applied per channel (different title variant, hashtags, thumbnail)
- Dry-run preview mode before committing
- Live batch progress via SSE

**Token Vault**
- Securely add/rotate OAuth tokens via UI (no terminal access needed)
- AES-256 encrypted storage on disk
- All rotations logged to audit trail
- Shows which channels have tokens configured per platform

**Audit Log**
- Every critical action logged: uploads, pauses, token rotations, bulk dispatches
- Timestamps, channel IDs, error reasons

**Cross-Platform Analytics**
- Side-by-side YouTube vs Instagram vs Facebook view comparison
- Per-channel platform breakdown bar charts

### Health Scoring Algorithm

Every 60 minutes the health worker scores each channel 0-100:

| Deduction | Points |
|---|---|
| CTR drop >60% vs baseline | -35 |
| Upload failure streak (×3) | -45 |
| Token missing | -40 |
| Monetization disabled | -30 |
| Views drop >50% | -25 |
| YouTube strike | -50 per strike |
| No upload in 14 days | -15 |

| Score | Status |
|---|---|
| 80-100 | 🟢 Healthy |
| 60-79 | 🟡 Warning |
| 40-59 | 🟠 Degraded |
| 0-39 | 🔴 Critical → Auto-paused + Alert sent |

### Notifications

Set either (or both) in `.env`:
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=bot...
TELEGRAM_CHAT_ID=...
```

Alerts sent for: critical channel status, rapid pivot triggers, bulk dispatch completions, channel recovery.

---

## Complete Command Reference

```bash
node src/index.js start             # Full system (all layers + dashboard + social)
node src/index.js dashboard         # CLI terminal dashboard
node src/index.js mission-control   # Web dashboard at :4002
node src/index.js generate -c 1     # Generate content for channel 1
node src/index.js generate -c 1 --topic "best AI tools"
node src/index.js analyze --days 7  # Performance report
node src/index.js optimize          # Run self-improvement cycle
node src/index.js crosspost -c 1 -v ./output/videos/video.mp4
node src/index.js health            # Run health check now
node src/index.js setup             # Setup wizard
node scripts/setup.js               # Initialize project
node scripts/oauth.js --channel 01  # OAuth for YouTube channel
```

## Port Map

| Port | Service |
|---|---|
| 3000 | OAuth callback server (temporary, during setup) |
| 4001 | Static file server (serves videos to Meta API) |
| 4002 | Mission Control web dashboard |
