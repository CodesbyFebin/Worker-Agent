# Worker Agent.Cloud

[![npm version](https://img.shields.io/npm/v/worker-agent-cloud.svg)](https://npmjs.com/package/worker-agent-cloud)
[![License: MIT](https://img.shields.io/github/license/Cyberteckmaster/Worker-Agent)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-%234488F4?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-%233178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Cyberteckmaster/Worker-Agent/ci.yml?branch=main)](https://github.com/Cyberteckmaster/Worker-Agent/actions)
[![Coverage](https://img.shields.io/endpoint/coverletter)](https://example.com)

> Mission Control for AI-powered content networks. Research trends, create content, enforce governance, run channels, and learn from every result.

---

## Why Worker Agent.Cloud?

Worker Agent.Cloud is a production-grade platform for autonomous content creation and publishing. Instead of manually researching topics, writing scripts, creating videos, and uploading to multiple platforms, you define your workflow once and let the agents handle the rest.

Key benefits:

- **Multi-platform automation**: Publish to YouTube, TikTok, Instagram, Facebook, LinkedIn, and more from one dashboard
- **AI-powered research**: Agents analyze trends, extract claims, and verify sources before content creation
- **Governance built-in**: Compliance scanning, policy enforcement, and approval gates
- **Cost-optimized**: Track AI costs per task, per organization, with budget controls
- **MCP Ready**: Connect external Model Context Protocol servers for custom tools

---

## Features

### Agent System

| Agent | Purpose | Tools |
|---|---|---|
| **Planner** | Decomposes goals into ordered subtask lists | Workflow orchestration |
| **Researcher** | Gathers trends, extracts claims, verifies sources | Web search, claim validation |
| **Writer** | Drafts scripts with retention hooks and metadata | Content generation |
| **Reviewer** | Reviews content for quality, compliance, policy | Approval workflows |
| **Coder** | Commits code changes via GitHub API | VCS operations |
| **QA** | Runs linting, typechecking, testing | Quality gates |
| **Publisher** | Uploads to YouTube, TikTok, Instagram, etc. | Multi-platform publishing |
| **Video Generator** | Creates videos via ffmpeg + Pollinations | Media generation |
| **Video Editor** | Edits and burns-in captions | Video processing |
| **Voiceover** | Generates TTS via StreamElements | Audio synthesis |
| **Caption/Hashtag** | Writes captions and hashtags | Engagement optimization |
| **SEO** | Generates titles, descriptions, tags | Metadata optimization |

### Platform Coverage

| Platform | Capabilities |
|---|---|
| **YouTube** | Videos, Shorts, Live, Analytics, Studio API |
| **TikTok** | Video upload, metadata management |
| **Instagram** | Reel upload, carousel posts |
| **Facebook** | Video upload, page management |
| **LinkedIn** | Video posts, article publishing |
| **Twitter/X** | Thread generation, video tweets |
| **Blogger** | Blog post publishing |

### Integration Layer

| Integration | Purpose |
|---|---|
| **MCP Client** | Connect to external MCP servers for custom tools |
| **GitHub** | Real commits, PRs, worktree management |
| **S3/MinIO** | Artifact storage with versioning |
| **Redis** | BullMQ job queues, caching |
| **Webhook System** | Event notifications to external services |

---

## Quick Start

### Prerequisites

- Node.js 20+ or Docker
- MySQL 8+ / MariaDB 10.6+
- Redis 6+

### Option 1: npm (Local Development)

```bash
git clone https://github.com/Cyberteckmaster/Worker-Agent.git
cd Worker-Agent
npm install
cp .env.example .env

# Start infrastructure (MySQL + Redis)
npm run local:infra

# Start development servers
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000

### Option 2: Docker (Full Stack)

```bash
docker compose up --build
```

### Option 3: GitHub Codespaces (Cloud Development)

Click "Code → Codespaces → New codespace" for a pre-configured environment.

---

## Client Configuration

### Agent Configuration

```bash
# Agent configuration via tRPC mutations
npm exec ccos configure agent \
  --name "researcher" \
  --provider anthropic \
  --model claude-3-7-sonnet-20250219
```

### MCP Server Registration

```bash
# Register an MCP server via API
curl -X POST http://localhost:4000/trpc/tools/registerMcpServer \
  -H "Content-Type: application/json" \
  -H "x-user-id: dev-user" \
  -d '{
    "name": "Memory Server",
    "transport": "http",
    "endpoint": "http://localhost:8080/mcp",
    "config": "{\"timeout\": 30000}"
  }'
```

---

## Architecture

See [Architecture Documentation](./docs/architecture.md) for a detailed system overview including:

- Client/Server interaction
- Workflow Engine
- God Machine orchestration
- Database schema
- Security model
- Scaling considerations

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React 19)                         │
│  20 workspaces, AppShell, Agent Rail, tRPC client           │
└──────────────────────┬──────────────────────────────────────┘
                       │ tRPC
┌──────────────────────▼──────────────────────────────────────┐
│                    SERVER (Express)                         │
│  18 routers, REST v1, SSE events, Webhooks                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GOD MACHINE ENGINE                     │   │
│  │  Planner ▶ Researcher ▶ Writer ▶ Reviewer ▶ ...    │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              WORKFLOW ENGINE                          │   │
│  │  WorkflowDefs ▶ Runs ▶ StepRuns ▶ Agent Executions   │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                      │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              TOOL GATEWAY                             │   │
│  │  Builtin Tools  MCP Tools  External APIs              │   │
│  └──────────────────────┬──────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   BULLMQ + REDIS    │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────┐
                │   DATABASE (MySQL)  │
                └─────────────────────┘
```

---

## Configuration

### Environment Variables

Required:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/worker_agent
ANTHROPIC_API_KEY=sk-ant-...
PORT=4000
```

Optional (choose providers):
```bash
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
TAVILY_API_KEY=...
YOUTUBE_CLIENT_ID=...
S3_ACCESS_KEY_ID=...
```

See `.env.example` for the complete reference.

---

## Development

### Project Structure

```
worker-agent-cloud/
├── client/           # React 19 frontend (port 5173)
├── server/           # Express + tRPC backend (port 4000)
├── drizzle/          # MySQL schema + migrations
├── docs/             # Documentation
├── examples/         # Executable examples
├── shared/           # Shared types/contracts
├── src/              # Legacy CC-OS CLI tools
└── docker-compose.yml # Local infrastructure
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API + Worker + Client (dev mode) |
| `npm run dev:api` | Start Express API only |
| `npm run dev:worker` | Start BullMQ workers only |
| `npm run dev:web` | Start Vite client only |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run build` | Build production bundles |
| `npm run validate` | Full validation suite (typecheck → lint → test → build) |
| `npm run local:infra` | Start MySQL + Redis via Docker |
| `npm run db:push` | Sync schema to database |
| `npm run db:generate` | Generate migrations |

### Docker Build

```bash
docker build -t worker-agent-cloud:latest .
docker run -p 4000:4000 --env-file .env worker-agent-cloud
```

---

## Testing

```bash
# Run all tests
npm run test

# Run specific test suite
npx vitest run server/tests/agent.runtime.test.ts

# Run with coverage
npx vitest run --coverage
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `ECONNREFUSED` on database | Run `npm run local:infra` or set `DATABASE_URL` |
| `401 Unauthorized` on API | Include `x-user-id` header for dev, or use session-based auth |
| SSE events not received | Check `Authorization` header and `/ready` endpoint |
| MCP tool not discovered | Verify server is enabled and `tools/list` responds |
| Rate limit exceeded | Check `RATE_LIMIT_MAX` setting, consider Redis-backed limits |
| Build fails | Run `npm run validate` to see which check failed |

---

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Configuration](./docs/configuration.md)
- [Architecture](./docs/architecture.md)
- [MCP Integration](./docs/mcp/tools.md)
- [Tool Gateway](./docs/concepts/tool-gateway.md)
- [API Reference](./docs/api/)

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run validate` to ensure all checks pass
5. Submit a pull request

Please read [contributing guidelines](./CONTRIBUTING.md) for more details.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

## Credits

- Built by [Cyberteckmaster](https://github.com/Cyberteckmaster)
- Uses [Vite](https://vitejs.dev/), [tRPC](https://trpc.io/), [Drizzle ORM](https://orm.drizzle.team/), [BullMQ](https://docs.bullmq.io/), [Express](https://expressjs.com/)

---

*Worker Agent.Cloud — Autonomous content at scale.*
