<p align="center">
  <img src="https://raw.githubusercontent.com/CodesbyFebin/Worker-Agent/main/docs/assets/worker-agent-logo.svg" alt="Worker Agent" width="120" />
  <h1 align="center">Worker Agent</h1>
  <p align="center">
    <strong>Open-source AI Agent Workspace</strong><br/>
    <em>Run autonomous agents. Build workflows. Conduct deep research. Monitor execution in real time. Keep your infrastructure under your control.</em>
  </p>
  <p align="center">
    <a href="https://github.com/CodesbyFebin/Worker-Agent/actions/workflows/ci.yml"><img src="https://github.com/CodesbyFebin/Worker-Agent/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/CodesbyFebin/Worker-Agent/actions/workflows/schema-guard.yml"><img src="https://github.com/CodesbyFebin/Worker-Agent/actions/workflows/schema-guard.yml/badge.svg" alt="Schema Guard" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/CodesbyFebin/Worker-Agent" alt="License: MIT" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.5" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" /></a>
  </p>
</p>

---

## 🚀 Quick Start

```bash
git clone https://github.com/CodesbyFebin/Worker-Agent.git
cd Worker-Agent
npm install
cp .env.example .env
npm run dev:all
```

Then open: `[http://localhost:5173](http://localhost:5173)`

---

## 🏗️ Architecture

```
┌─────────────────────┐
│    Worker Agent UI  │
│     React + Vite    │
└──────────┬──────────┘
           │ tRPC / SSE
┌──────────▼──────────┐
│       API           │
│ Node / TypeScript   │
└──────┬───────┬──────┘
       │       │
┌──────▼──┐ ┌──▼──────┐
│Database │ │  Redis  │
│MariaDB  │ │ BullMQ  │
└─────────┘ └────┬─────┘
                 │
        ┌─────────▼─────────┐
        │   Worker          │
        │   Agent Jobs      │
        └─────────┬─────────┘
                  │
   ┌──────────────┴──────────────┐
   │ AI / Research / Tooling     │
   └─────────────────────────────┘
```

---

## 🧠 Feature Matrix

| Capability | Status |
|---|---|
| Agent workspace | ✅ |
| Multi-workspace architecture | ✅ |
| AI model selection | ✅ |
| Workflow automation | ✅ |
| Deep Research | ✅ |
| Real-time events (SSE) | ✅ |
| Agent execution history | ✅ |
| RBAC | ✅ |
| Self-hosting | ✅ |
| tRPC API | ✅ |
| REST API | ✅ |
| Webhooks | ✅ |
| Worker queues (BullMQ) | ✅ |
| Schema Guard (CI) | ✅ |
| Docker deployment | ✅ |
| Security scanning | ✅ |

---

## 🔒 Security

- **Argon2** password hashing
- **HttpOnly** + **Secure** + **SameSite** session cookies
- **Rate limiting** on authentication endpoints
- **Audit logging** for all security-relevant actions
- **Organization isolation** enforced at tRPC + SSE + database level
- **Secret scanning** in CI (gitleaks + dependency review + CodeQL)
- See [SECURITY.md](./SECURITY.md) for disclosure policy

---

## 🛠️ Development

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- MariaDB 11.4+ (or Docker)
- Redis 7+ (or Docker)

### Running Locally

```bash
# Services
npm install

# Terminal 1: API Server
npm --prefix server run dev:api

# Terminal 2: Worker (BullMQ)
npm --prefix server run dev:worker

# Terminal 3: Frontend
npm --prefix client run dev
```

### Database Baseline (RC-1 Gate)

```bash
npx drizzle-kit generate --config=drizzle.config.ts
npx drizzle-kit db:push --config=drizzle.config.ts
```

The `Schema Guard` CI workflow automatically detects drift between `drizzle/schema.ts` and generated migrations.

---

## ☁️ Self-Hosting

```bash
# Option 1: Docker Compose (development)
docker-compose up -d

# Option 2: Production (systemd + Nginx)
bash deployment/scripts/bootstrap.sh
```

See [deployment/README.md](./deployment/README.md) for full instructions.

**Ports:** `4000` (API), `5173` (client), `3306` (MariaDB), `6379` (Redis)

**Health checks:** `GET /health` (liveness), `GET /ready` (readiness)

---

## ✨ Content Authority & SEO

WorkerAgent publishes evidence-gated content under `/learn/`. Not all planned
topics are published — indexability is gated by evidence verification and
peer review. See the DC design files for current content structure:

- `Worker Agent.dc.html` — Dashboard shell (Nocturne: deep black + violet glow)
- `Worker Agents Guide.dc.html` — Long-form evidence-gated reference guide
- `Pillar - Worker Agents by Industry.dc.html` — PSEO pillar (healthcare, finance, e-commerce, etc.)
- `Pillar - Types of Worker Agents.dc.html` — PSEO pillar (task, workflow, conversational, autonomous, hybrid)
- `Pillar - Benefits of Worker Agents.dc.html` — PSEO pillar (quantified impact, risk mitigation)

Each pillar page uses an **Evidence Matrix** table with verification status
(VERIFIED / PARTIAL / UNVERIFIED / NOT PUBLIC) to comply with Google's 2026
Generative Search guidelines and AEO/GEO best practices.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

- Fork → Branch → Install → Run locally → Tests → PR → CI → Review → Merge

---

## 📜 License

[MIT](./LICENSE) — built for the open-source community.

---

<p align="center">
  <strong>Star this repo</strong> if you believe AI agents need enterprise-grade infrastructure, not just API wrappers. ⭐
</p>
