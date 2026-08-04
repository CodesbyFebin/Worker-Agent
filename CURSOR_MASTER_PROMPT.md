# Master Prompt for Cursor — WorkerAgent.Cloud

## How to use this

**Recommended:** Open the existing `worker-agent-cloud/` project folder (from
the delivered zip) directly in Cursor, then paste the section **"Working
agreement"** below into a `.cursorrules` file (or Cursor's project
instructions) before asking Cursor to build anything further. The codebase
already exists and works — you want Cursor extending it, not regenerating
it from a blank slate.

**If you're bootstrapping fresh** (no existing folder), paste this entire
document as your first message to Cursor. Everything from "Tech stack"
onward is a complete, accurate spec of what to build.

---

## Working agreement (put this in `.cursorrules`)

```
This is WorkerAgent.Cloud, a multi-agent content/dev automation platform.
Follow these rules on every change:

1. NEVER present mock, placeholder, or hardcoded fake data as if it were a
   real integration. If you can't wire a real API in this pass, write a
   function that throws a clear "not implemented" error — do not return
   canned fake data that looks plausible. (This project has already had to
   rip out one "research protocol" that always returned the same fake
   article regardless of query — do not reintroduce that pattern anywhere.)

2. NEVER invent specific metrics, accuracy percentages, or benchmark
   numbers in comments, docs, or UI copy (e.g. "99.2% accuracy") unless
   they come from an actual test run you executed. If you don't have real
   numbers, say so, or omit the claim.

3. Every external integration (API, service, library) must use REAL
   endpoints/SDKs and real request/response shapes — verify against actual
   docs, don't guess a plausible-looking shape.

4. When something is a deliberate scope cut or known limitation, say so
   explicitly in a code comment and in README.md's "Known limits" section
   — don't silently ship a partial implementation as if it were complete.

5. Match the existing file/folder conventions exactly (see "Directory
   structure" below) — one file per agent/service/router, not monoliths.

6. Every new DB change goes through drizzle/schema.ts + relations.ts, with
   real foreign keys and indexes, not loose columns.

7. Before adding a new npm dependency, check if the existing dependency
   list already covers it.
```

---

## Executive summary

A multi-agent studio: isolated agents research, write, code, generate
video, review, and publish — each in its own Git worktree, orchestrated via
a durable job queue, all visible live from one shell. React 19 + tRPC +
Drizzle + MySQL + BullMQ/Redis. Real integrations only — no mocked
external services presented as functional.

---

## Tech stack

- **Client**: React 19, Vite, Tailwind v4, `@trpc/react-query`, TanStack Query, `lucide-react`
- **Server**: Express, tRPC v10, Drizzle ORM (MySQL via `mysql2`), Zod
- **Queue**: BullMQ + Redis (`ioredis`)
- **LLM**: `@anthropic-ai/sdk`, model `claude-sonnet-4-6`
- **Git integration**: `@octokit/rest`, real `git worktree` shell commands
- **Media (free, no API key)**: Pollinations.ai (images), StreamElements TTS
  (voiceover), `ffmpeg`/`ffprobe` (video assembly, real binary, must be on PATH)
- **Search (real, free-tier)**: Tavily, Brave Search, Serper — fanned out in
  parallel. (Bing's Web Search API was retired by Microsoft in Aug 2025 —
  do not build a Bing adapter, it can't be provisioned anymore.)
- **Publishing**: real API adapters for YouTube, TikTok, Instagram,
  Facebook, X/Twitter, LinkedIn, Blogger

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
│   │            worktree-manager, god-machine, youtube-automode, queue, index)
│   ├── agents/ (12 role files + base.ts shared lifecycle + index.ts registry)
│   ├── routers/ (script, ledger, godMachine, campaign, _app)
│   └── services/
│       ├── vcs/github.ts
│       ├── publishing/{youtube,tiktok,instagram,facebook,twitter,linkedin,blogger,types,index}.ts
│       ├── media/{ffmpeg,pollinationsImage,streamElementsTTS,srt}.ts
│       ├── metadata/{youtubeMetadata,thumbnailPrompter}.ts
│       ├── search/{tavily,brave,serper,index,types}.ts
│       ├── verification/{claimValidator,researchProtocol,pageFetcher,domainTrust}.ts
│       ├── script/regenerateSection.ts
│       └── campaign/contentCalendar.ts
├── drizzle/{schema,relations}.ts
├── shared/{types,contracts}/
└── README.md · .env.example
```

---

## Database schema — 9 tables

| Table | Key columns |
|---|---|
| `users` | id, email — replace with real auth |
| `scripts` | id, userId, title, fullText, targetDurationSeconds |
| `script_sections` | id, scriptId, kind, order, content, wordCount |
| `generated_metadata` | id, scriptId, titles (json), description, tags (json), thumbnailPrompt |
| `claim_ledger` | id, scriptId, devtag, claimText, sourceUrl, confidenceScore, verificationStatus (`pending`/`verified`/`rejected`/`unverifiable`) |
| `agent_tasks` | id, parentTaskId, scriptId, campaignId, dayIndex, agentRole, title, order, payload (json), result (json), worktreeId, status, attempts, inputTokens, outputTokens, costUsd, scheduledAt, errorMessage |
| `content_campaigns` | id, userId, topic, totalDays, startDate, status |
| `agent_worktrees` | id, branchName, path, agentDepartment, isLocked, removedAt |
| `agent_events` | id, taskId, eventType, message, createdAt |

`agentTaskStatusEnum`: `pending, assigned, running, awaiting_approval, blocked, completed, failed`
`agentRoleEnum`: `planner, researcher, writer, reviewer, coder, qa, publisher, video_generator, video_editor, voiceover, caption_hashtag, seo`

---

## Agent roster — all 12 roles need real executors

| Role | Real implementation |
|---|---|
| `planner` | LLM decomposes goal → ordered subtask list |
| `researcher` | LLM summarizes + flags claims needing verification |
| `writer` | Drafts content + returns a `reasoning` note |
| `reviewer` | Structured approve/reject + issues list |
| `coder` | Real GitHub commit/push/PR via Octokit + `reasoning` note |
| `qa` | Runs real `lint`/`typecheck`/`test` npm scripts, skips missing ones |
| `publisher` | 7 real platform adapters (below) |
| `video_generator` | Pollinations.ai stills → ffmpeg Ken Burns clips → concat |
| `video_editor` | ffmpeg mux + proportional-heuristic caption burn-in |
| `voiceover` | StreamElements free TTS |
| `caption_hashtag` | LLM caption + hashtag generation |
| `seo` | YouTube metadata + thumbnail prompt generation |

Every task runs through a shared lifecycle (`agents/base.ts`):
`pending → assigned (worktree created) → running → completed/failed`,
with token/cost usage tracked automatically via `AsyncLocalStorage`
(zero changes needed per-agent) and a persistent per-campaign-day
artifacts directory (`.artifacts/<campaignId>/day-<n>/`) for binary
outputs that must survive past the task's own Git worktree teardown.

**Publisher platforms**: YouTube (real Data API v3 resumable upload, local
file path supported), TikTok (Content Posting API v2, two-step init+upload),
Instagram (Graph API media container + publish), Facebook (Graph API page
feed/video), X (API v2 tweet creation — note real posting typically needs
OAuth1 user-context, not just a bearer token), LinkedIn (UGC Posts API),
Blogger (v3 posts.insert, needs an OAuth token despite the env var name).

---

## Durable job queue (BullMQ + Redis) — critical architectural pattern

**The key insight, don't lose it in a naive implementation**: durability
comes from each job's processor enqueuing the *next* step before
returning — not from merely wrapping an existing function call in a queue.
An in-process loop that awaits several steps in sequence is NOT durable
even if individual steps are queued; if the process restarts mid-loop,
that loop is gone. The correct pattern:

```
processor(jobData):
  result = await runOneStep(jobData)
  if hasNextStep:
    await queue.add(nextJobData)   // <- this line is what makes it durable
  else:
    markChainComplete()
```

Three queues: `god-machine-chain` (one job per subtask in a goal's task
tree), `campaign-day` (one job per pipeline stage in a YouTube AutoMode
day, carrying accumulated state like script/video/audio paths forward in
the job payload), `scheduled-publish` (real BullMQ delayed jobs — no
`setInterval` polling).

Connection: build from `REDIS_URL`, never hardcode host/port. BullMQ has
no default export — `import { Queue, Worker, QueueEvents } from "bullmq"`.

---

## Research protocol — real search, not mock

`services/search/{tavily,brave,serper}.ts` fan out in parallel (Promise.allSettled,
dedupe by URL). At least one API key must be configured or `webSearch`
throws clearly rather than silently returning nothing. `pageFetcher.ts`
does real HTTP fetch + regex-based text extraction (label this as a
heuristic, not a real readability parser). `domainTrust.ts` is a coarse
3-tier heuristic (high/medium/low) — do not invent fake-precise decimal
authority scores for domains you have no real data on. `researchProtocol.ts`'s
`verifyClaim` ties it together: search → fetch → LLM checks for genuine
supporting sentences/contradictions per source → confidence score.

---

## Design system

| Token | Hex | Meaning |
|---|---|---|
| `--color-ink` | `#0b0e14` | Page background |
| `--color-surface` | `#12151d` | Panel background |
| `--color-amber` | `#e3a64b` | Agent actively working |
| `--color-teal` | `#35c9a5` | Verified / safe / completed |
| `--color-coral` | `#e2636b` | Failed / blocked |
| `--color-violet` | `#9b8cff` | **Reserved only for "a human needs to act"** — never reuse elsewhere |

Type: IBM Plex Mono (headers/labels/data), Inter (body). Signature
element: the **Agent Rail** — a persistent strip on every screen (not just
one dashboard tab) showing every agent task currently `running`/`assigned`
platform-wide, polling every 3s.

---

## API surface — 15 procedures across 4 routers

- **`script`**: `regenerateSection`, `generateMetadata`
- **`ledger`**: `listByScript`, `extractAndLog`, `setStatus`, `verifyClaim`
- **`godMachine`**: `dispatchGoal`, `runSubtask`, `getTaskTree`, `listRootTasks`, `listActive`
- **`campaign`**: `start`, `list`, `getDays`, `approveDay`

---

## Environment variables

```
DATABASE_URL=              # required
ANTHROPIC_API_KEY=         # required
PORT=4000
REDIS_URL=redis://localhost:6379   # required for God Machine / YouTube AutoMode

GITHUB_TOKEN=
GITHUB_REPO=                # "owner/repo"
GITHUB_BASE_BRANCH=main

YOUTUBE_ACCESS_TOKEN=
YOUTUBE_CHANNEL_ID=
TIKTOK_ACCESS_TOKEN=
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
FACEBOOK_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
TWITTER_BEARER_TOKEN=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_ORG_URN=
BLOGGER_API_KEY=             # actually an OAuth access token
BLOGGER_BLOG_ID=

TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
SERPER_API_KEY=

PRICE_PER_MILLION_INPUT_TOKENS_USD=0   # set for real cost estimates
PRICE_PER_MILLION_OUTPUT_TOKENS_USD=0

VITE_API_URL=http://localhost:4000/trpc
```

Only `DATABASE_URL`, `ANTHROPIC_API_KEY`, `PORT`, and `REDIS_URL` are
required at boot. Everything else is optional — each integration only
errors when actually used unconfigured.

---

## Current known limits (tell Cursor NOT to silently "fix" these by faking a solution — real fixes only)

1. Queue workers run in the same process as the API — splitting into a
   separate worker container is the correct next step, not a workaround.
2. OAuth token refresh isn't built for any publishing adapter.
3. Caption timing is a proportional heuristic, not real word-level alignment.
4. TikTok/Instagram need a public video URL; only YouTube works from a
   local file path — a real fix needs actual S3/GCS/CDN upload, not a fake one.
5. Cost meter totals land on task completion, not truly real-time.
6. QA Agent has no sandbox beyond the Git worktree.

## Suggested build order for a fresh scaffold

If bootstrapping from nothing (no existing repo), build in this order —
each phase should be fully working before starting the next:

1. Drizzle schema + Express/tRPC skeleton + Script Studio (script, ledger extraction only)
2. Agentic runtime: worktree manager, planner/researcher/writer/reviewer, God Machine UI
3. Coder/QA/Publisher agents + orchestration (in-process is fine as a first pass)
4. YouTube AutoMode's fixed pipeline + free media generation
5. Durable job queue (BullMQ) — replace in-process orchestration per the pattern above
6. Real research protocol (search + fetch + verify)
7. Design system + AppShell + Agent Rail unifying all workspaces
