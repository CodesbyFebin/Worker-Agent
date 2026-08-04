# Worker Agent.Cloud

A multi-agent studio: isolated agents research, write, code, generate video,
review, and publish — each in its own Git worktree, all visible live from
one shell. Built in phases; every phase below is real, running code, not a
mockup. Where something is a deliberate scope cut rather than an oversight,
it's called out explicitly.

## Contents

1. [Quick start](#quick-start)
2. [Design system](#design-system)
3. [Workspaces](#workspaces)
4. [Architecture by phase](#architecture-by-phase)
5. [Environment variables](#environment-variables)
6. [Durable job queue (BullMQ + Redis)](#durable-job-queue-bullmq--redis--replaces-in-process-orchestration)
7. [Research protocol](#research-protocol--real-web-search--fetch-not-mock)
8. [Known limits, on purpose](#known-limits-on-purpose)

---

## Quick start

```bash
cp .env.example .env        # fill in DATABASE_URL, ANTHROPIC_API_KEY, etc.
npm run local:infra         # Windows: start MariaDB + Redis 5 (port 6380)
npm install                 # from repo root (workspaces)
npm run db:push             # pushes the Drizzle schema to your MySQL instance
npm run dev:server          # http://localhost:4000
npm run dev:client          # http://localhost:5173
```

You'll also need `ffmpeg`/`ffprobe` on PATH (for YouTube AutoMode's video
assembly) and, if you're using the Coder Agent or GitHub-integrated
features, an actual Git repo for `GOD_MACHINE_REPO_ROOT` to point at.

---

## Design system

Vibe theme — neon cyber / retrowave (reference: magenta · cyan · lime on deep
purple-black). Semantic token **names** are stable; values map to the vibe
palette so every workspace inherits it.

| Token | Value | Role |
|---|---|---|
| `--color-ink` | `#05030c` | Page background — deep purple-black |
| `--color-surface` | `#0e0a18` | Panel background |
| `--color-surface-raised` | `#161022` | Raised cards / active nav |
| `--color-line` | `#2a2040` | Borders |
| `--color-amber` | `#b8ff3c` | **Neon lime** — agent working / primary CTA |
| `--color-teal` | `#00e8f0` | **Electric cyan** — verified / safe / secondary glow |
| `--color-coral` | `#ff3d8a` | **Hot magenta** — failed / blocked / brand heat |
| `--color-violet` | `#ff2bd6` | **Vivid pink** — human action only |

Type: **Syne** for display/brand, **Outfit** for body UI, **JetBrains Mono**
for code and status chips. Shared utilities in `client/src/styles/index.css`:
`.vibe-panel`, `.vibe-frame`, `.btn-vibe-primary`, `.btn-vibe-secondary`,
`.text-vibe-brand`, plus cyan/magenta/lime glow CSS vars. Grid + radial
washes sit on `body` — no fake star/user marketing metrics baked into the
theme.

**Signature element — the Agent Rail** (`components/AgentRail.tsx`): a
persistent strip on every screen showing every agent task actually running
right now, anywhere in the platform. Not a dashboard you have to remember to
check — it's the ambient answer to the one question this whole product
exists to make legible: *what are the agents doing right now?*

The rest of the UI (`ScriptEditor`, `LedgerExplorer`, `TaskTreeVisualizer`,
`CampaignStudio`) now uses these named tokens too instead of plain Tailwind
`neutral-*`/`emerald-*`/`red-*` classes — migrated in this pass. `blocked`
and `failed` currently share the coral token at different opacities (70%
vs. 100%) rather than getting a fifth accent color, to keep the palette to
the 4 named semantic accents in the table above.

### Since the last pass

- **Claim status `unverifiable`** — a real fourth status, distinct from
  `rejected`: some claims genuinely can't be resolved either way. A manual
  override control was added to `LedgerExplorer` (`ledger.setStatus`).
- **Live cost/token meter** — every LLM call's usage is now recorded via
  `AsyncLocalStorage` (`_core/costTracking.ts`) with zero changes needed in
  any individual agent file, and persisted on `agent_tasks.inputTokens` /
  `outputTokens` / `costUsd`. Cost only appears once a task **completes**
  (not truly live mid-execution — that would need streaming token counts,
  not built here). Set `PRICE_PER_MILLION_INPUT_TOKENS_USD` /
  `_OUTPUT_TOKENS_USD` in `.env` for real dollar estimates instead of just
  token counts — left at 0 by default rather than hardcoding a rate that
  could be stale.
- **"Why did you write this"** — the writer and coder agents now return a
  short `reasoning` string alongside their output, shown inline in
  `TaskTreeVisualizer` and folded into the coder's PR description.

---

## Workspaces

`AppShell.tsx` switches between five workspaces via a left nav, with the
Agent Rail always visible on the right:

- **Script Studio** — live word count/read-time telemetry, highlight-to-
  regenerate sections, AI-generated titles/description/tags/thumbnail prompt.
- **Claim Ledger** — Mission Control UI over real ledger aggregates: status
  squad cards, hourly spark (today), status donut, claim register, activity
  feed, extract + batch-verify commands. Metrics come from `claim_ledger`
  only — no fabricated growth %.
- **God Machine** — ChatGPT-style chat UI with **Ask** (single LLM turn) and
  **Codex** (planner → multi-agent BullMQ chain with expandable steps,
  worktrees, retries). Past goals live in the left conversation rail.
- **IDEa IDE** — agent roster, recent tasks, reasoning/event inspector, cost
  rollup, SSE live refresh (`GET /events`). Surfaces only real DB fields —
  no invented confidence percentages.
- **YouTube AutoMode / Shorts & Reels** — ContentOps studio (creative brief,
  phone preview, scene editor, multi-track timeline, evidence/safety,
  approval gate, output formats). Wired to real `campaign.*` + claim ledger.
  Sidebar includes **Platform** (5 core apps) and full **Content Ops** nav from
the WorkerAgent references: Overview, Workspace, Automations, Research-to-Post,
YouTube, Shorts & Reels, Social Manager, Blogging Studio, Research, Drafts,
Evidence, Approvals, Publishing, Template Library, Plugins & Connectors,
Credentials, Calendar, Inbox, Activity, Governance, Learn, Settings. Brand mark
is the purple→cyan **W** logo. Connector status is env-backed (`connectors.list`)
— never fake marketplace counts.

---

## Architecture by phase

### Phase 1 — Script Studio
`drizzle/schema.ts` (`script_sections`, `generated_metadata`) ·
`server/routers/script.router.ts` (`regenerateSection`, `generateMetadata`,
both real Anthropic API calls) · `client/src/features/script-studio/*`.

### Phase 2 (partial) — Claim Ledger
`claim_ledger` table · `server/routers/ledger.router.ts`
(`listByScript`, `extractAndLog`) · `LedgerExplorer.tsx`. Extraction is real;
moving claims from `pending` to `verified`/`rejected` against actual sources
(a real research/retrieval protocol) is **not built** — don't mistake
`extractAndLog` for that.

### Phase 3 — Agentic Runtime
`server/_core/worktree-manager.ts` (real `git worktree add/remove`) ·
`server/agents/{planner,researcher,writer,reviewer}.agent.ts` · shared
lifecycle in `agents/base.ts` (pending → assigned → running →
completed/failed) · `godMachine.router.ts` · `TaskTreeVisualizer.tsx`.

### Phase 4 — Orchestration + Coder/QA/Publisher
- **Coder Agent** (`coder.agent.ts` + `services/vcs/github.ts`) — real
  commit/push/PR via `@octokit/rest`. Needs `GITHUB_TOKEN` + `GITHUB_REPO`.
- **QA Agent** (`qa.agent.ts`) — runs your actual `lint`/`typecheck`/`test`
  npm scripts in the worktree; skips (doesn't fail) ones that don't exist.
- **Publisher Agent** (`publisher.agent.ts` + `services/publishing/*`) —
  seven real platform adapters: YouTube, TikTok, Instagram, Facebook, X,
  LinkedIn, Blogger. **None have been run against live credentials** — each
  is a correctly-shaped implementation of that platform's real API, not a
  pre-verified integration. Test against sandbox credentials first.
- **Orchestration Engine** (`_core/god-machine.ts`) — `dispatchGoal`
  auto-runs the whole subtask chain in order, retrying failures 3x with
  exponential backoff + jitter. A task that exhausts retries blocks every
  downstream subtask rather than letting them run against a broken
  prerequisite.
- **Event bus** (`_core/events.ts` + `agent_events` table) — every status
  change/retry/error is persisted and fanned out to in-process subscribers.
  The client still polls rather than consuming this over SSE — the bus is
  ready for that route, but the route itself isn't built.

### YouTube AutoMode
One topic → N days, each running a fixed 9-stage pipeline:
`researcher → writer → video_generator → voiceover → video_editor →
caption_hashtag → seo → reviewer → publisher (held for approval)`.

- **Real, free, no-API-key media generation**: Pollinations.ai for images
  (`services/media/pollinationsImage.ts`), StreamElements' unofficial free
  TTS (`streamElementsTTS.ts`), real `ffmpeg`/`ffprobe` for Ken Burns clips,
  audio muxing, and subtitle burn-in (`ffmpeg.ts`). Captions are timed by a
  **proportional heuristic** (character count over known audio duration),
  not real word-level alignment — expect drift on longer scripts.
- **A real bug this caught and fixed**: task worktrees are torn down
  immediately after each task finishes. Fine for code, but it would have
  silently deleted a day's video/audio before the next stage could read it.
  Fixed with a persistent per-day artifacts directory
  (`.artifacts/<campaignId>/day-<n>/`) that survives worktree teardown —
  see `agents/base.ts`.
- **The approval gate is real**: the publisher stage is created in
  `awaiting_approval` status and is never auto-dispatched.
  `campaign.approveDay` is the only thing that flips it to `pending`.
- **Scheduling** (`_core/scheduler.ts`) polls every 60s for approved
  publisher tasks whose `scheduledAt` has arrived.

---

## Environment variables

See `.env.example` for the full list. Everything beyond `DATABASE_URL`,
`ANTHROPIC_API_KEY`, and `PORT` is optional at boot — each integration
(GitHub, each publishing platform) only errors when you actually try to use
it without its vars configured.

---

## Durable job queue (BullMQ + Redis) — replaces in-process orchestration

Both the God Machine chain and YouTube AutoMode's daily pipeline now run as
durable jobs instead of in-process loops:

- **`_core/queue.ts`** — real BullMQ + Redis setup. (A pasted reference file
  earlier in this project had `import Queue, {...} from 'bullmq'` — BullMQ
  has no default export, that's a real bug — and a hardcoded
  `{ host: 'localhost', port: 6379 }` connection that silently ignored
  `REDIS_URL`. Both fixed here.)
- **The actual fix isn't just "wrap dispatchTask in a queue"** — it's that
  each job's processor enqueues the *next* step before returning. That's
  what makes the whole chain durable, not just one step: if the server
  restarts between steps, the next job is already sitting in Redis for any
  worker to pick up, instead of being lost with an in-memory loop.
- **`god-machine.ts`** — `orchestrateGoal` now enqueues one job per subtask;
  BullMQ handles retry/backoff itself (no more manual retry loop). On final
  failure (all of BullMQ's own attempts exhausted), a `QueueEvents` "failed"
  listener blocks every downstream subtask, same behavior as before.
- **`youtube-automode.ts`** — the 9-stage day pipeline is now one job per
  stage, carrying the accumulated state (script, video path, audio path...)
  forward in the job payload itself. All N days are enqueued immediately;
  the campaign-day worker's `concurrency: 5` combined with day-by-day
  independence means multiple days' stages can interleave — the original
  "protect free rate-limited endpoints" goal is better served by adjusting
  worker concurrency than by artificially blocking day 2 until day 1
  fully finishes, which the old in-process version did.
- **Scheduled publishing** — `schedulePublish` enqueues a real BullMQ
  delayed job (backed by Redis) instead of the old 60s `setInterval`
  poller, which is now deleted (`scheduler.ts`).

### Still real limits, even with the queue

- **Workers run in the same process as the API** (see `_core/index.ts`) for
  simplicity. A production deployment should run them in a separate
  worker process/container so deploying the API doesn't also restart
  in-flight job processing.
- **Redis is now a hard dependency** for God Machine and YouTube AutoMode —
  neither works without `REDIS_URL` pointing at a real Redis instance.
- **Queue generics are loosely typed** — `enqueue`/`registerWorker` in
  `queue.ts` don't thread each queue's specific job-data type through
  BullMQ's `Queue<DataType, ResultType, NameType>` generics precisely, to
  avoid a circular import between `queue.ts` and the modules that define
  those types. Functionally fine (BullMQ doesn't enforce types at runtime);
  a minor type-safety gap, not a behavioral one.

## Research protocol — real web search + fetch, not mock

A second pasted reference file claimed to be a "Safe Deep Research
Protocol," but its `discoverSources` always returned one hardcoded fake
source (`example.com/article-1`, "Expert Author", credibility `0.85`)
regardless of the query — the LLM verification logic downstream was real,
but it would have been scoring claims against a fabricated article that
doesn't exist. **Not merged as-is.** Rebuilt with actually-real sourcing:

- **`services/search/{tavily,brave,serper}.ts`** — three real search APIs,
  fanned out in parallel (`services/search/index.ts`), deduped by URL.
  (Bing's Web Search API was retired by Microsoft in August 2025 with no
  new keys issued — deliberately not one of the options.) At least one of
  `TAVILY_API_KEY` / `BRAVE_SEARCH_API_KEY` / `SERPER_API_KEY` must be set.
- **`services/verification/pageFetcher.ts`** — fetches real URLs and
  extracts text via a regex-based heuristic (not a real readability
  parser) — won't handle JS-rendered pages, may pull in nav/footer noise.
- **`services/verification/domainTrust.ts`** — a deliberately coarse
  3-tier heuristic (high/medium/low), not fake-precise decimal scores like
  the pasted file's `0.847`-style numbers implying data that doesn't exist.
- **`services/verification/researchProtocol.ts`** — `verifyClaim` runs the
  real pipeline: search → fetch → LLM checks for genuine supporting
  sentences and contradictions per source → confidence score. Wired into
  **`ledger.verifyClaim`** and a "verify" button in `LedgerExplorer`.
- **Treat confidence scores as a triage signal, not a certified fact-check**
  — heuristic extraction and coarse trust tiers mean this is meaningfully
  better than mock data, but still short of a rigorous verification system.

## Known limits, on purpose

- **Local Windows infra (this machine).** MariaDB may run as a user process
  (not a Windows service) when service install needs elevation; Redis for
  BullMQ listens on **6380** via the portable Redis 5 build under
  `C:\Redis5`, because the winget "Redis on Windows" package is 3.0.504 and
  is too old for BullMQ — and stopping that system service also needs
  elevation. Use `npm run local:infra` to (re)start both. BullMQ warns that
  Redis **>= 6.2** is recommended; 5.0.14 works for basic queues but is a
  known compromise until a newer Redis (Memurai/WSL/Docker) can be installed
  with elevation. This is an environment workaround, not an application fake.
- **LLM routing.** `LLM_PROVIDER=auto` tries free backends first
  (`ollama` → `openrouter` → `nvidia` → `pollinations` → `groq` → `gemini` →
  `anthropic`). OpenRouter (`OPENROUTER_API_KEY`) exposes live `:free` models
  plus `openrouter/free` router; NVIDIA NIM (`NVIDIA_API_KEY` from
  build.nvidia.com) is OpenAI-compatible credit-based free tier; Groq/Gemini
  need free-tier keys; Pollinations anonymous text is rate-limited. Free model
  catalogs are fetched from provider APIs when keys are set — not hardcoded
  marketing lists. Failures throw; nothing returns canned fake completions.
  See IDEa → Models for live status.
- **Campaign pause does not cancel in-flight `dispatchTask` calls** — it only
  stops the queue worker from advancing to the next stage (re-queues with
  delay). Full cancellation needs a separate worker process + abort tokens.
- **SSE `/events` has no auth yet** — same stand-in as `x-user-id` header auth.
- **IDEa is not a VS Code fork** — it is an in-app agent visibility IDE over
  real tasks/events/costs. Marketing docs that claim "100 IDEa capabilities"
  / patent-eligible IDE features are out of scope projections, not this build.
- **OAuth token refresh is out of scope.** Every publishing adapter takes a
  bearer/access token from env as a given. Getting and refreshing real
  user-context tokens (several platforms need more than a static token —
  X/Twitter posting in particular typically needs OAuth1 user-context
  signing) is a whole feature in itself.
- **Free media endpoints are informally rate-limited.** Pollinations and
  StreamElements can throttle or change without notice. Now handled via
  worker concurrency (see the queue section above) rather than blocking
  entire days sequentially.
- **QA Agent has no sandbox beyond the Git worktree** — runs test/lint
  commands directly on the host. Fine for trusted code; add a real
  container boundary before pointing it at untrusted input.
- **TikTok/Instagram need a public video URL**, not a local file path.
  YouTube publishing works with local files because its own upload API
  takes bytes directly — the other platforms' APIs fetch the URL
  server-side, so you'd need to upload the rendered file to S3/GCS/a CDN
  first. That upload step isn't built.
- **Cost meter isn't truly real-time.** Token/cost totals are written when
  a task *completes*, not streamed during execution — a task that's still
  `running` won't show partial cost yet.
