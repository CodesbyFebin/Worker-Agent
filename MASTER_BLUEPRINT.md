# Worker Agent.Cloud — Master Blueprint
### The real system, as actually built — not a projection

This document describes exactly what exists in the codebase today: every
table, every agent, every API procedure, every honest gap. Nothing below is
aspirational unless it's explicitly labeled "not built." Where earlier
pasted documents in this project claimed numbers (300+ capabilities, 26
tables, 50+ procedures, 18-month engineering leads, patent-eligible
pipelines), this blueprint reports what's actually there instead — real
counts, not projections.

## Contents

1. [System architecture](#system-architecture)
2. [Directory structure](#directory-structure)
3. [Database schema — 9 real tables](#database-schema--9-real-tables)
4. [Agent roster — 12 roles](#agent-roster--12-roles)
5. [API surface — 15 procedures across 4 routers](#api-surface--14-procedures-across-4-routers)
6. [Data flow walkthroughs](#data-flow-walkthroughs)
7. [Design system](#design-system)
8. [Environment variables](#environment-variables)
9. [Known limits, on purpose](#known-limits-on-purpose)
10. [What's next](#whats-next)

---

## System architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      CLIENT (React 19 + Vite)                 │
│  AppShell: left nav (4 workspaces) + persistent Agent Rail     │
│  ┌───────────────┬───────────────┬───────────┬──────────────┐ │
│  │ Script Studio │ Claim Ledger  │God Machine│YouTube        │ │
│  │               │               │           │AutoMode       │ │
│  └───────────────┴───────────────┴───────────┴──────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           tRPC (httpBatchLink)
┌──────────────────────────▼──────────────────────────────────┐
│                    SERVER (Express + tRPC)                   │
│  routers/: script · ledger · godMachine · campaign            │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  _core/god-machine.ts — orchestration engine          │    │
│  │  _core/youtube-automode.ts — fixed daily pipeline     │    │
│  │  _core/queue.ts — BullMQ+Redis durable execution      │    │
│  │  _core/events.ts — event bus (persisted + in-process) │    │
│  │  _core/costTracking.ts — AsyncLocalStorage usage meter│    │
│  │  _core/worktree-manager.ts — real git worktree add/rm │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  agents/ (12 roles, all 12 wired to real executors)   │    │
│  │  planner · researcher · writer · reviewer · coder ·   │    │
│  │  qa · publisher · video_generator · video_editor ·    │    │
│  │  voiceover · caption_hashtag · seo                    │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  services/                                            │    │
│  │  vcs/github.ts · publishing/{7 platforms} ·           │    │
│  │  media/{ffmpeg,pollinations,streamElements,srt} ·     │    │
│  │  metadata/{youtube,thumbnail} ·                       │    │
│  │  verification/{claimValidator,researchProtocol,       │    │
│  │    pageFetcher,domainTrust} · search/{tavily,brave,   │    │
│  │    serper} · campaign/contentCalendar                 │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                        Drizzle ORM
┌──────────────────────────▼──────────────────────────────────┐
│                     MySQL — 9 tables                          │
└───────────────────────────────────────────────────────────────┘
```

---

## Directory structure

```
worker-agent-cloud/
├── client/src/
│   ├── components/{AppShell,AgentRail}.tsx
│   ├── features/
│   │   ├── script-studio/{ScriptEditor,ScriptTelemetry,RegenerateSection,MetadataGenerator}.tsx
│   │   ├── claim-ledger/LedgerExplorer.tsx
│   │   ├── god-machine/TaskTreeVisualizer.tsx
│   │   └── youtube-automode/CampaignStudio.tsx
│   ├── lib/trpc.ts · styles/index.css (design tokens) · App.tsx · main.tsx
├── server/
│   ├── _core/  (env, db, trpc, context, llm, costTracking, events,
│   │            worktree-manager, god-machine, youtube-automode,
│   │            scheduler, index)
│   ├── agents/ (12 role files + base.ts shared lifecycle + index.ts registry)
│   ├── routers/ (script, ledger, godMachine, campaign, _app)
│   └── services/
│       ├── vcs/github.ts
│       ├── publishing/{youtube,tiktok,instagram,facebook,twitter,linkedin,blogger,types,index}.ts
│       ├── media/{ffmpeg,pollinationsImage,streamElementsTTS,srt}.ts
│       ├── metadata/{youtubeMetadata,thumbnailPrompter}.ts
│       ├── verification/claimValidator.ts
│       ├── script/regenerateSection.ts
│       └── campaign/contentCalendar.ts
├── drizzle/{schema,relations}.ts
├── shared/{types,contracts}/
└── README.md · .env.example
```

---

## Database schema — 9 real tables

| Table | Purpose |
|---|---|
| `users` | Minimal stand-in — replace with your real auth table |
| `scripts` | A script's full text, target duration, owner |
| `script_sections` | Modular blocks (hook/body/cta/outro) for Regenerate Section |
| `generated_metadata` | Cached AI titles/description/tags/thumbnail prompt |
| `claim_ledger` | Extracted factual claims: devtag, confidence, status (`pending`/`verified`/`rejected`/`unverifiable`) |
| `agent_tasks` | The recursive task tree — role, order, status, payload, result, worktree, campaign/day linkage, retry attempts, **token/cost usage**, scheduled publish time |
| `content_campaigns` | A YouTube AutoMode run — topic, total days, start date, status |
| `agent_worktrees` | Tracks real `git worktree` checkouts per task |
| `agent_events` | Persisted lifecycle log (status changes, retries, errors) |

Not built: a dedicated `research_sources` / `verification_log` table for a
real Safe Deep research protocol — claim extraction exists, but verifying
a claim against real fetched sources does not.

---

## Agent roster — 12 roles

| Role | Wired to a real executor? | What it actually does |
|---|---|---|
| `planner` | Yes (via `planGoal`, not the generic dispatcher) | LLM decomposes a goal into an ordered subtask list |
| `researcher` | Yes | LLM summarizes + flags claims needing verification (no live web access) |
| `writer` | Yes | Drafts content; now also returns a `reasoning` note |
| `reviewer` | Yes | Structured approve/reject + issues list |
| `coder` | Yes | Real GitHub commit/push/PR via Octokit; also returns `reasoning` |
| `qa` | Yes | Runs your real `lint`/`typecheck`/`test` npm scripts |
| `publisher` | Yes | 7 real platform adapters (see below) |
| `video_generator` | Yes | Pollinations.ai stills → ffmpeg Ken Burns clips → concat |
| `video_editor` | Yes | ffmpeg mux + proportional-heuristic caption burn-in |
| `voiceover` | Yes | StreamElements free TTS |
| `caption_hashtag` | Yes | LLM caption + hashtag generation |
| `seo` | Yes | Wraps the existing YouTube metadata + thumbnail services |

All 12 roles have real executors — nothing in the roster is a stub that
throws "not implemented." (Earlier phases had `coder`/`qa`/`publisher`
unimplemented; that gap was closed in Phase 4.)

**Publisher platforms**: YouTube, TikTok, Instagram, Facebook, X/Twitter,
LinkedIn, Blogger — real API calls, **none verified against live
credentials**. Reddit was never built (an earlier pasted document claimed
it was; it wasn't).

---

## API surface — 15 procedures across 4 routers

- **`script`**: `regenerateSection`, `generateMetadata`
- **`ledger`**: `listByScript`, `extractAndLog`, `setStatus`, `verifyClaim`
- **`godMachine`**: `dispatchGoal`, `runSubtask`, `getTaskTree`, `listRootTasks`, `listActive`
- **`campaign`**: `start`, `list`, `getDays`, `approveDay`

---

## Data flow walkthroughs

### God Machine: one goal
1. `dispatchGoal` → `orchestrateGoal` → `planGoal` (LLM decomposes into an
   ordered subtask list, persisted to `agent_tasks`).
2. `runChain` runs each subtask in order via `dispatchTask`, retrying up to
   3x with exponential backoff + jitter.
3. A task that exhausts retries marks every downstream subtask `blocked`.
4. Client polls `getTaskTree` every 3s; `AgentRail` polls `listActive` every 3s.

### YouTube AutoMode: one day
`researcher → writer → video_generator → voiceover → video_editor →
caption_hashtag → seo → reviewer → publisher (created as `awaiting_approval`,
never auto-run)`. A human calls `approveDay`, which flips the publisher
task to `pending`; the scheduler dispatches it once `scheduledAt` arrives.
Binary outputs (images/video/audio) are written to a persistent
`.artifacts/<campaignId>/day-<n>/` directory — not the task's own Git
worktree, which is torn down immediately after each task finishes.

---

## Design system

Named tokens (not the generic dark-mode default):

| Token | Hex | Meaning |
|---|---|---|
| `--color-amber` | `#e3a64b` | Agent actively working |
| `--color-teal` | `#35c9a5` | Verified / safe / completed |
| `--color-coral` | `#e2636b` | Failed / blocked |
| `--color-violet` | `#9b8cff` | **Reserved only for "a human needs to act"** |

Type: IBM Plex Mono (headers/labels/data), Inter (body). Signature element:
the **Agent Rail** — persistent on every screen, showing every task
currently `running`/`assigned` platform-wide. All four workspaces are
migrated onto these tokens as of this pass.

---

## Environment variables

Only `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `PORT` are required at boot.
Everything else (GitHub, each of the 7 publishing platforms, cost-per-token
pricing) is optional — each integration only errors when you actually try
to use it unconfigured. Full list in `.env.example`.

---

## Known limits, on purpose

- **Job queue workers run in the same process as the API.** BullMQ + Redis
  now makes the God Machine chain and YouTube AutoMode's daily pipeline
  genuinely durable across a restart (each job enqueues the next step
  before returning, so nothing lives only in memory) — but the worker
  processes themselves aren't split out into a separate container/process
  yet, so deploying the API also restarts in-flight job *processing*
  (queued/delayed jobs themselves are unaffected, sitting safely in Redis).
- **Redis is now a hard dependency** for God Machine and YouTube AutoMode.
- **Research protocol confidence scores are a triage signal, not a
  certified fact-check** — page-text extraction is a regex heuristic (no
  real readability parser, won't handle JS-rendered pages), and domain
  trust is a deliberately coarse 3-tier heuristic, not real authority data.
- **OAuth token refresh is out of scope** for every publishing adapter —
  they take a static bearer/access token from env as a given.
- **Caption timing is a proportional heuristic**, not real word-level
  alignment — expect drift on longer scripts.
- **Free media/search endpoints (Pollinations, StreamElements, and the
  search APIs' free tiers) are rate-limited** and can change without notice.
- **TikTok/Instagram need a publicly reachable video URL**; only YouTube
  publishing works from a local file path.
- **Cost meter isn't truly real-time** — totals land when a task completes.
- **QA Agent has no sandbox beyond the Git worktree** — runs commands
  directly on the host.

## What's next

In priority order, based on what's flagged above: (1) split queue workers
into a separate process/container from the API, (2) a media-hosting step
so TikTok/Instagram can actually receive campaign videos, (3) OAuth token
refresh for the publishing adapters, (4) a real readability parser to
replace the regex-based page-text extraction, (5) SSE/WebSocket route on
top of the existing event bus so the client stops polling.
