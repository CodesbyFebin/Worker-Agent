# Repository Audit

## 1. Architecture Map

### Layer Stack

```
CLIENT                          SERVER
┌─────────────────────────┐   ┌──────────────────────────────────┐
│ React 19 + Vite         │   │ Node.js (Express)                 │
│                         │   │                                    │
│  Marketing/Landing     │   │  _core/                           │
│  Mission Control       │   │    index.ts       — HTTP server    │
│  Workspaces (18+)      │   │    trpc.ts        — tRPC factory  │
│  tRPC Client           │   │    context.ts     — session ctx   │
│  SSE Client            │   │    health.ts      — /health,/ready│
│  SSE Events            │   │    events.ts      — event bus     │
│                         │   │    queue.ts       — BullMQ setup  │
│                         │   │    metrics.ts     — Prometheus    │
│                         │   │    worker.ts      — Worker entry  │
│                         │   │    auth/          — auth system   │
│                         │   │    god-machine.ts — Goal planner  │
│                         │   │                                    │
│                         │   │  routers/                         │
│                         │   │    _app.ts        — tRPC router   │
│                         │   │    auth           — login/auth    │
│                         │   │    godMachine     — agent exec    │
│                         │   │    workflow       — WF engine     │
│                         │   │    agents         — agent CRUD    │
│                         │   │    knowledge      — embeddings    │
│                         │   │    governance     — policies      │
│                         │   │    youtubeStudio  — YouTube ops   │
│                         │   │    tools          — MCP/tool gw   │
│                         │   │    ide            — script editor │
│                         │   │    chat           — chat          │
│                         │   │    rest.v1        — REST facade   │
│                         │   │    openapi.ts     — OpenAPI spec  │
│                         │   │                                    │
│                         │   │  services/                        │
│                         │   │    agent/        — agent runners  │
│                         │   │    workflow/     — step executor  │
│                         │   │    knowledge/    — RAG/embeddings │
│                         │   │    youtube/      — YouTube API    │
│                         │   │    python/       — Python bridge  │
│                         │   │    tools/        — tool gateway   │
│                         │   │                                    │
│                         │   │  tests/                          │
│                         │   │    auth.tenancy.test.ts           │
│                         │   │    workflow.compiler.test.ts    │
│                         │   │    governance.advanced.test.ts  │
│                         │   │    health.contract.test.ts       │
└─────────────────────────┘   └──────────────────────────────────┘

SHARED                DATABASE
┌─────────────────┐  ┌─────────────────────────┐
│ drizzle/        │  │ MariaDB / MySQL         │
│  schema.ts      │  │  62 tables              │
│  relations.ts   │  │  8 enum types           │
│  migrations/    │  │  FK constraints         │
│  sql/           │  │  Indexes                │
└─────────────────┘  └─────────────────────────┘
                            │
                     ┌──────┴──────┐
                     │ Redis       │
                     │  Sessions    │
                     │  BullMQ      │
                     │  SSE bus      │
                     └──────────────┘
```

### Data Flow

```
1. Client request (REST/GraphQL/SSE)
   → API :4000
   → tRPC middleware (auth check, org scoping)
   → tRPC procedure (business logic)
   → Drizzle ORM query (MariaDB)
   → Response (JSON / SSE stream)

2. Async task
   → API enqueues BullMQ job (Redis)
   → Worker picks up job
   → Worker calls provider API (OpenAI/Anthropic/etc)
   → Worker publishes SSE event (Redis → EventEmitter → SSE stream)
   → Result persisted to MariaDB
```

## 2. Dependency Map

### Client (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.0 | UI framework |
| vite | 5.4 | Build/dev server |
| @trpc/client | 10.45 | API client |
| @trpc/react-query | 10.45 | React tRPC hooks |
| @tanstack/react-query | 4.36 | Query cache |
| @xyflow/react | 12.11 | Workflow visual builder |
| monaco-editor/react | 4.7 | Code editor |
| lucide-react | 0.383 | Icons |
| superjson | 2.2 | Serialization |
| tailwindcss | 4.0 | Styling |

### Server (server/package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.19 | HTTP framework |
| @trpc/server | 10.45 | API framework |
| drizzle-orm | 0.33 | ORM |
| mysql2 | 3.11 | Database driver |
| bullmq | 5.12 | Job queue |
| ioredis | 5.4 | Redis client |
| argon2 | 0.40 | Password hashing |
| prom-client | 15.1 | Prometheus metrics |
| pino | 10.3 | Structured logging |
| @opentelemetry/sdk-node | 0.221 | Tracing |
| @anthropic-ai/sdk | 0.27 | AI provider |
| @aws-sdk/client-s3 | 3.1103 | S3 storage |
| @octokit/rest | 21.0 | GitHub API |

### Root Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| drizzle-orm | 0.33 | ORM (shared) |
| drizzle-kit | 0.24.2 | Schema generation (strict) |
| vitest | 4.11 | Testing |
| zod | 4.4 | Validation |

## 3. Security Findings

### IMPLEMENTED

- ✅ Argon2id password hashing (`server/_core/auth/credentials.ts`)
- ✅ HttpOnly + Secure + SameSite cookies (`server/_core/auth/session.ts:hashToken`)
- ✅ Session tokens hashed with SHA-256 before storage
- ✅ Rate limiting: 10 login attempts/minute per IP (`server/_core/auth/session.ts`)
- ✅ Rate limiting: configurable API limiter (`server/_core/rateLimit.ts`)
- ✅ Audit logging for all security-relevant actions (`server/_core/auth/audit.ts`)
- ✅ Secret redaction in logs (`server/_core/redact.ts`) — masks sk-, nvapi-, ghp_, Bearer tokens
- ✅ Organization isolation: enforced at tRPC (`.organizationProcedure`), SSE (`subscribeToEvents` filters by org), REST (`requireOrg()` + organizationId checks), and database queries (all queries scoped with `eq(table.organizationId, orgId)`)
- ✅ Dev login disabled in production (`NODE_ENV === "production"` check)
- ✅ CI gitleaks secret scanning (`.github/workflows/security.yml`)
- ✅ CI CodeQL static analysis
- ✅ CI dependency review (fail on high severity + GPL licenses)
- ✅ CI Schema Guard (prevents schema drift)
- ✅ Security.md with coordinated disclosure
- ✅ Minimal cookie exposure: SESSION_COOKIE = `wa_session`
- ✅ Passwords never logged
- ✅ Tokens hashed before storage (`hashToken()` in session.ts)

### PARTIALLY VERIFIED

- ⚠️ Cookie `Secure` flag only set when `NODE_ENV=production` — verified in setSessionCookie
- ⚠️ Session TTL is 24 hours (`SESSION_TTL_MS` in permissions.ts)

### NEEDS ATTENTION

- ⚠️ No MFA enforcement policy (mfaFactors table exists but no enforcement logic in auth router)
- ⚠️ No Content-Security-Policy header (nginx config doesn't set CSP)
- ⚠️ Rate limiting is in-memory (not Redis-backed for multi-replica)
- ⚠️ No CSRF token (cookies are SameSite=Lax which mitigates most CSRF)

## 4. Database Findings

### IMPLEMENTED

- ✅ 62 production tables (59 base + user_credentials + compliance Verdicts + quotaLedger)
- ✅ 8 enum types with foreign key constraints
- ✅ Drizzle migrations tracked (`drizzle/migrations/0000_pretty_black_tarantula.sql`)
- ✅ Schema Guard CI prevents drift
- ✅ Baseline SQL verified (62 CREATE TABLE statements)

### Critical: Schema Drift

- ❌ `drizzle/migrations/` was in `.gitignore` at commit `c1c8269` (frozen main)
- ❌ Schema Guard workflow at `8dead3e` requires tracked migrations
- ✅ Current working tree: `drizzle/migrations/` IS tracked (removed from .gitignore during commit `8dead3e`)
- ✅ Baseline SQL SHA256: `03a63285...` matches commit `8dead3e`

## 5. Authentication Findings

### Implemented Architecture

- Session-based auth (not JWT)
- Argon2id password hashing
- SHA-256 token hashing for storage
- httpOnly + Secure + SameSite=Lax cookies
- 24-hour session TTL
- Role-based access control (RBAC) with 4 tiers: owner, admin, member, viewer
- 34 permission keys seeded into database
- Organization-scoped data access (every query includes organizationId filter)

### Dev Login Protection

- `devLogin` procedure in `server/routers/auth.router.ts` throws FORBIDDEN in production
- Production login uses `login` procedure with real email/password validation
- All auth context created from cookie tokens only (never from headers)

## 6. API Findings

### tRPC API

- 18 routers registered in `_app.ts`:
  auth, script, ledger, godMachine, campaign, ide, connectors, settings, pipeline, workflow, knowledge, agents, tools, governance, artifacts, ops, youtubeStudio, chat

### Procedures

- `publicProcedure` — no auth required
- `authenticatedProcedure` — session required
- `organizationProcedure` — session + org membership required
- `permissionProcedure(permission)` — specific permission check

### REST API v1

- 8 endpoints at `/api/v1/`:
  - GET `/health` — liveness + counters
  - GET `/openapi.json` — OpenAPI 3.1 spec
  - GET `/workflows` — org-scoped workflow list
  - POST `/goals` — dispatch agent goal
  - GET `/campaigns` — org-scoped campaigns
  - GET `/youtube/channels` — YouTube channel list
  - GET `/knowledge/search` — knowledge search
  - GET `/knowledge/semantic` — semantic search
  - POST `/knowledge/embeddings` — upsert embeddings

### SSE API

- `GET /events` — org-scoped real-time event stream
- Event types: `connected`, `agent` events (status_changed, retry, error, info, pipeline_handoff), `research` events
- 25-second heartbeat
- Max 50 EventEmitter listeners
- Automatic disconnect cleanup

## 7. Frontend Findings

### Client Structure

- 18 feature modules: activity, agents, automations, claim-ledger, content, evidence, god-machine, idea-ide, learn, ops, overview, plugins, script-studio, social, templates, tools, youtube-automode, youtube-studio
- Marketing component (landing page with cinematic design)
- Mission Control (dashboard)
- 18 workspace components mapped from URL paths

### Routing

- Hash-based routing via AppShell (not URL router)
- URL → workspace mapping defined in `PATH_TO_WORKSPACE`
- 9 primary routes with fallback to dashboard

### Visual Design

- Cinematic dark theme with nebula gradients
- CSS custom properties for theme colors
- Tailwind CSS v4
- CSS variables: `--color-ink`, `--color-violet`, `--color-teal`, `--glow-green`, etc.

## 8. SEO Findings

### Implemented

- ✅ Descriptive README title and description
- ✅ Badge bar with build status and license
- ✅ Architecture diagram in README

### Missing

- ❌ Canonical documentation URLs strategy
- ❌ robots.txt
- ❌ sitemap.xml
- ❌ Structured data (JSON-LD)
- ❌ llms.txt / llms-full.txt
- ❌ GitHub Pages deployment
- ❌ SEO meta tags on documentation pages

## 9. Documentation Findings

### Implemented

- ✅ Comprehensive docs/ directory (50+ files) with categories:
  - getting-started (installation, configuration, first-agent)
  - concepts (agents, workspaces, workflows, research, events)
  - architecture (overview, api, workers, queues, security, observability)
  - self-hosting (docker, production, troubleshooting)
  - contributing (development, testing, pull-requests)
  - community (roadmap)
  - adr (5 architectural decision records)

### Missing

- ❌ GitHub Pages deployment
- ❌ GitHub Wiki
- ❌ Interactive documentation
- ❌ Canonical documentation strategy

## 10. GitHub Findings

### Implemented

- ✅ CI workflow (type-check + test + build)
- ✅ Schema Guard workflow
- ✅ Security workflow (gitleaks, CodeQL, dependency review, Scorecard)
- ✅ Docker workflow
- ✅ Issue templates (bug_report, feature_request, security, documentation)
- ✅ Pull request template
- ✅ SECURITY.md
- ✅ CODEOWNERS

### Missing

- ❌ GitHub Discussions configuration
- ❌ GitHub Pages deployment
- ❌ Dependabot configuration
- ❌ GitHub Topics/Labels setup

## 11. Community Findings

### Missing

- ❌ GitHub Discussions categories
- ❌ Roadmap with evidence
- ❌ Contributor recognition
- ❌ Examples gallery

## 12. Deployment Findings

### Implemented

- ✅ Docker multi-stage Dockerfile (api, worker, client targets)
- ✅ docker-compose.yml (mysql, redis, api, worker, client, python-api, python-worker, minio)
- ✅ Nginx config (deployment/nginx/)
- ✅ systemd service units (deployment/systemd/)
- ✅ Bootstrap script (deployment/scripts/)
- ✅ Health checks (/health liveness, /ready readiness)
- ✅ Prometheus metrics endpoint (/metrics)

### Missing

- ❌ Deployment matrix documentation
- ❌ Observability documentation
- ❌ Backup/restore documentation

## 13. Performance Findings

### Implemented

- ✅ Vite for fast dev/build
- ✅ Structured logging (pino)
- ✅ Prometheus metrics
- ✅ OpenTelemetry tracing
- ✅ Connection pooling (mysql2 pool with limit:10)
- ✅ Worker separation (API never blocks on jobs)

### Missing

- ❌ Bundle analysis
- ❌ Lighthouse CI
- ❌ Performance budgets

## 14. Accessibility Findings

### Missing

- ❌ prefers-reduced-motion media query
- ❌ ARIA labels on interactive elements
- ❌ Keyboard navigation verification
- ❌ Color contrast audit
- ❌ Screen reader testing

## 15. Technical Debt

| Item | Severity | Notes |
|------|----------|-------|
| Root package.json named "youtube-cc-os" | Medium | Legacy name, doesn't match product |
| Root package.json has old scripts | Medium | References `src/index.js`, `youtube-cc-os` keywords |
| Vercel config has legacy redirects | Medium | Still references YouTube-specific routes |
| `.env.example` mixes legacy CC-OS and Worker Agent settings | High | Confusion for new developers |
| No production-ready frontend build for API/worker separation | Low | Docker handles this |
| In-memory rate limiting | Medium | Doesn't scale across replicas |

## 16. Critical Blockers

None. All CI checks (Schema Guard, Security, Build) are functional.

## 17. High-ROI Opportunities

| # | Priority | Opportunity | Impact |
|---|----------|-------------|--------|
| 1 | P1 | GitHub Pages documentation site | Discoverability + developer experience |
| 2 | P1 | GitHub Discussions configuration | Community building |
| 3 | P1 | Examples gallery | Developer adoption |
| 4 | P1 | ADR documentation | Technical credibility |
| 5 | P1 | OpenAPI + REST API docs | Developer adoption |
| 6 | P1 | Observability docs | Production confidence |
| 7 | P1 | Deployment matrix | Self-hosting clarity |
| 8 | P2 | Release discipline (CHANGELOG + tags) | Project maturity |
| 9 | P2 | Roadmap with evidence | Community transparency |
| 10 | P2 | Security maturity docs | Enterprise trust |

## 18. Production Certification Status

| Criterion | Status |
|-----------|--------|
| Authentication (Argon2id + session cookies) | ✅ IMPLEMENTED |
| Authorization (RBAC + org isolation) | ✅ IMPLEMENTED |
| HTTPS enforced (nginx) | ❌ NOT IN REPO |
| Rate limiting | ✅ PARTIALLY (in-memory) |
| Audit logging | ✅ IMPLEMENTED |
| Secret scanning (CI) | ✅ IMPLEMENTED |
| Dependency scanning (CI) | ✅ IMPLEMENTED |
| Schema drift prevention | ✅ IMPLEMENTED |
| Backup strategy | ⚠️ DOCUMENTED (scripts exist) |
| Health checks | ✅ IMPLEMENTED |
| Metrics endpoint | ✅ IMPLEMENTED |

**Overall: NOT CERTIFIED FOR PRODUCTION** (HTTPS config external, MFA not enforced)
**Status: Production-capable with operational configuration**