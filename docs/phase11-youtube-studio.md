# Phase 11 — YouTube Automation Studio

Extends Phases 0–10 into a multi-channel YouTube factory. **Does not** rebuild auth, tenancy, or the workflow engine.

## Mapping

| Layer | Implementation |
|-------|----------------|
| Data Brain | `youtube_trends` + `youtubeStudio.searchTrends` (YouTube Data API v3) |
| Asset Forge | Workflow nodes `video.script` / `voice` / `broll` / `assemble` / `compliance` / `youtube.upload` |
| Sanity Shield | `video.compliance` + DLQ/Recovery (Phase 10) |
| Multi-instance | Org-scoped `youtube_channels` with **env-key** OAuth (no raw tokens in DB) + distinct User-Agents |
| Adaptive optimizer | BullMQ `youtube-analytics` every 6h |

## Layout (existing monorepo)

```
drizzle/schema.ts + drizzle/sql/phase11_youtube_studio.sql
server/services/youtube/{studio,analyticsWorker}.ts
server/routers/youtubeStudio.router.ts
client/src/features/youtube-studio/YoutubeStudioWorkspace.tsx
.cursor/mcp.json  → @jcodesmore/youtube-for-ai-agents
```

## Apply

```bash
node --env-file=.env scripts/apply-phase11-sql.mjs
```

Restart API (seeds `youtube:read|write|publish`).

## Env

```bash
YOUTUBE_API_KEY=           # trend search
YOUTUBE_ACCESS_TOKEN=      # or per-channel YOUTUBE_ACCESS_TOKEN_CH01 …
PEXELS_API_KEY=            # royalty-free b-roll
ELEVENLABS_API_KEY=        # optional; else StreamElements TTS
```

## Try

1. **YT Studio** → bind channel (env key name)
2. Pipeline → Ensure Scriptwriter → Seed long-form template
3. **Automations** → YouTube palette / edit canvas
4. Publish run (needs ffmpeg on PATH + tokens for upload)

## White-hat rules enforced in code

- Script prompt injects rotating human-noise seeds
- Per-channel User-Agent on upload/API
- B-roll only via Pexels (throws if key missing — no fake stock)
- Compliance scan before upload path; hits → `awaiting_approval`

## Limits (honest)

- OAuth refresh still out of scope — rotate access tokens externally
- `avgViewDuration` needs YouTube Analytics API scope; without it the optimizer only acts when stored ratios exist
- `/yt-search` Cursor slash commands are not native — use UI or tRPC
- Full 10-channel scale needs 10 org/channel bindings + 10 env tokens
