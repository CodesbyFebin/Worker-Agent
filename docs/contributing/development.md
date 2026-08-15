# Development Guide

This guide covers setting up a local development environment for Worker Agent.

## Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- MariaDB 11.4+ (or Docker)
- Redis 7+ (or Docker)

## Quick Start

```bash
# Clone
git clone https://github.com/CodesbyFebin/Worker-Agent.git
cd Worker-Agent

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your values

# Run all services (if using Docker for deps)
docker-compose up -d mysql redis

# 1. API Server
npm --prefix server run dev:api

# 2. Worker
npm --prefix server run dev:worker

# 3. Frontend
npm --prefix client run dev
```

## Project Structure

```
Worker-Agent/
├── client/              # React + Vite (frontend)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── features/    # Feature workspaces
│   │   ├── marketing/   # Landing page
│   │   ├── mission-control/  # Command center
│   │   └── styles/      # CSS variables
│   └── package.json
├── server/              # Node + Express (backend)
│   ├── _core/           # Core infrastructure
│   │   ├── auth/        # Authentication
│   │   ├── trpc.ts      # tRPC type factories
│   │   ├── health.ts    # Health endpoints
│   │   ├── worker.ts    # Worker entry
│   │   └── ...
│   ├── routers/         # tRPC routers
│   └── package.json
├── drizzle/             # Database schema
│   ├── schema.ts        # 62-table schema
│   ├── relations.ts     # Relations
│   └── sql/             # Historical phase SQL
├── services/            # Python microservices
├── docs/                # Documentation
└── deployment/          # Deployment configs
```

## Development Guidelines

- Run `npm run typecheck` in both `server/` and `client/` before committing
- All tRPC procedures must use proper authentication (`authenticatedProcedure`, `organizationProcedure`)
- Never expose secrets in client code
- SSE events must be organization-scoped
- See [Pull Requests](./pull-requests.md) for review process