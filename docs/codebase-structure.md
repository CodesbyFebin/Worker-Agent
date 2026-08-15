# Codebase Structure

This document explains the structure of the Worker Agent.Cloud codebase, including the coexistence of legacy and modern implementations.

## Overview

The repository contains two main application architectures:

1. **Modern Platform** (`server/` + `client/`) — React 19 + Express tRPC API
2. **Legacy CLI** (`src/`) — Node.js CLI for YouTube automation

## Modern Platform (recommended)

```
worker-agent-cloud/
├── client/                 # React 19 frontend
│   ├── src/
│   │   ├── App.tsx         # Main application entry
│   │   ├── features/       # Feature workspaces
│   │   │   ├── script-studio/
│   │   │   ├── claim-ledger/
│   │   │   ├── god-machine/
│   │   │   └── youtube-automode/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── components/
│   └── package.json        # React + Vite + Tailwind 4
├── server/                 # Express + tRPC backend
│   ├── _core/              # Core infrastructure
│   │   ├── index.ts        # Main entry point
│   │   ├── context.ts      # tRPC context
│   │   ├── health.ts       # Health endpoints
│   │   ├── queue.ts        # BullMQ setup
│   │   ├── db.ts           # Drizzle DB connection
│   │   └── logger.ts       # Pino logging
│   ├── agents/             # 12 agent implementations
│   │   ├── planner.ts
│   │   ├── researcher.ts
│   │   ├── writer.ts
│   │   └── ...
│   ├── routers/            # tRPC routers
│   │   ├── _app.ts         # Root router
│   │   ├── auth.router.ts
│   │   ├── script.router.ts
│   │   └── ...
│   ├── services/           # External integrations
│   │   ├── publishing/     # YouTube, TikTok, Instagram, etc.
│   │   ├── media/          # ffmpeg, TTS, image generation
│   │   ├── verification/   # Claim validation, research
│   │   └── plugins/        # AI provider routing
│   └── package.json        # Express + tRPC + BullMQ
├── drizzle/                # Database schema
│   ├── schema.ts           # Table definitions (25+ tables)
│   ├── relations.ts        # ORM relations
│   └── sql/                # Migration files
├── shared/                 # Shared types and contracts
└── package.json            # Root workspace config
```

## Legacy CLI System (maintained)

```
src/
├── index.js                    # CLI entry point (CC-OS)
├── orchestrator/master.js       # 5-layer pipeline engine
├── layers/
│   ├── layer1-data-brain/     # Trend analysis, keyword prediction
│   ├── layer2-asset-forge/    # Script generation, TTS, thumbnails
│   ├── layer3-sanity-shield/  # Copyright scanning, policy checks
│   ├── layer4-multi-runner/   # Channel management, upload scheduler
│   └── layer5-optimizer/      # A/B testing, retention analysis
├── youtube/youtube-api.js       # YouTube Data API client
├── cli/
│   ├── dashboard.js           # Terminal dashboard
│   ├── generate.js            # Content generation CLI
│   ├── analyze.js             # Performance analysis
│   └── setup.js               # Setup wizard
├── dashboard/                  # Mission Control web dashboard (port 4002)
├── social/                     # Crossposting to Instagram/Facebook
├── database/schema/            # Database schema (legacy)
├── utils/                      # Utilities
└── layers/                     # AI model layers
```

## Key Differences

| Aspect | Modern Platform | Legacy CLI |
|---|---|---|
| **UI** | React 19 + Vite | Terminal UI |
| **API** | tRPC + REST | Direct DB queries |
| **Deployment** | Web-based | Local execution |
| **Authentication** | Session-based | Dev-only (planned OAuth) |
| **Multi-plat** | 7 platforms | YouTube primary |
| **MCP Support** | Client integration | No support |

## Migration Path

New contributors and integrations should use the **Modern Platform**:

1. Use `npm run dev` for local development
2. Access the React frontend at http://localhost:5173
3. Use tRPC client for type-safe API access
4. All MCP integrations go through the Tool Gateway

The legacy CLI (`src/`) is maintained for:
- Historical content generation use cases
- Bulk processing scripts
- Terminal-based workflows
