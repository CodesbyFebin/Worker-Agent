# FAQ

Frequently asked questions about Worker Agent.

## Getting Started

### How do I install Worker Agent locally?

```bash
git clone https://github.com/CodesbyFebin/Worker-Agent.git
cd Worker-Agent
npm install
cp .env.example .env
npm run dev:all
```

Then visit `[http://localhost:5173](http://localhost:5173)`.

### What are the system requirements?

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 20.x | 20.x LTS |
| npm | 10.x | 10.x |
| MariaDB | 10.6+ | 11.4+ |
| Redis | 7.0+ | 7.x |
| Disk | 20GB | 100GB+ |
| Memory | 4GB | 8GB+ |

### Can I run Worker Agent with Docker?

Yes. See [Docker Self-Hosting Guide](./self-hosting/docker.md):

```bash
docker compose up -d
```

### Do I need to configure LLM providers?

Worker Agent supports multiple providers with auto-fallback. At minimum, set one of:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`

Or use Ollama for local models: `OLLAMA_BASE_URL=http://localhost:11434`

### Is there a demo I can try?

See the [Examples](./../examples/) directory for working projects. The examples include copy-paste code for common use cases.

## Architecture

### How does Worker Agent differ from LangChain?

Worker Agent is a complete platform — not just an agent framework. It includes:
- Production-grade API server with authentication and organization tenancy
- Background worker system with BullMQ job queues
- Real-time SSE event streaming
- Mission Control dashboard
- Full audit logging, RBAC, and compliance features

LangChain is a library for building agent chains. Worker Agent is a self-hostable application.

### What is Deep Research?

Deep Research is Worker Agent's multi-phase research pipeline:

1. **User Request** — You describe a research topic
2. **Agent Planning** — The agent creates a research plan
3. **Search** — Searches using configured providers
4. **Retrieval** — Reads and processes sources
5. **Synthesis** — Synthesizes findings with confidence scoring
6. **Results** — Returns the report via SSE streaming

### How does SSE work?

Worker Agent streams real-time events via Server-Sent Events at `GET /events`.

- Requires authentication (session cookie)
- Events are organization-scoped (Organization A never sees Organization B's events)
- 25-second heartbeat keeps connections alive
- Automatic reconnection by browser `EventSource`

Event types:
- `connected` — Initial connection confirmation
- `research` — Research phase updates
- `status_changed` — Agent status updates
- `error` — Agent errors
- `info` — Progress information

### When should I use tRPC vs REST API?

- **tRPC** — Type-safe client-server communication, used by the React frontend
- **REST** — For external integrations and simple scripts

Both APIs have identical authentication and authorization. REST is auto-documented via OpenAPI at `/api/v1/openapi.json`.

## Deployment

### How do I deploy to production?

See the [Production Self-Hosting Guide](./../self-hosting/production.md):

1. Clone the repository
2. Set environment variables (see `docs/self-hosting/nginx/`)
3. Build Docker images
4. Configure Nginx as reverse proxy with TLS
5. Start API, Worker, and Client services

### Can I deploy to Kubernetes / Docker Swarm?

Yes. The docker-compose.yml defines all required services. For production clusters:
- Use your own MariaDB and Redis instances
- Deploy API and Worker as separate services
- Point to external databases via environment variables

### What ports does Worker Agent use?

| Service | Port | Purpose |
|---------|------|---------|
| API Server | 4000 | tRPC + REST + SSE |
| Worker | 4001 | BullMQ processors (internal) |
| Frontend | 5173 | Vite dev server |
| Nginx | 80/443 | Reverse proxy (production) |
| MariaDB | 3306 | Database |
| Redis | 6379 | Cache + queues + SSE |
| MinIO | 9000 | File storage (optional) |

### How do I set up TLS/HTTPS?

For production, use Nginx with Let's Encrypt:

```bash
sudo certbot --nginx -d your-domain.com
```

The Nginx config (`deployment/nginx/workeragent-cloud.conf`) includes TLS termination configuration.

## Security

### Is Worker Agent secure?

Worker Agent implements defense-in-depth:
- Argon2id password hashing
- HttpOnly + Secure + SameSite session cookies
- Organization-level data isolation at all layers
- Rate limiting on authentication
- Audit logging for security-relevant actions
- Secret scanning in CI

See [Security Documentation](./../security.md) for details.

### What is the devLogin procedure?

`devLogin` is a development-only authentication procedure. It creates a temporary session for local development without requiring real email/password credentials.

**It is disabled in production** (`NODE_ENV=production`). The procedure throws `FORBIDDEN` when production mode is detected.

### How are organizations isolated?

Organization isolation is enforced at 4 layers:

1. **tRPC**: Every organization-scoped procedure uses `organizationProcedure` which validates membership
2. **SSE**: The `/events` stream filters by `organizationId`
3. **REST**: Every endpoint checks `requireOrg()` for organization membership
4. **Database**: All queries include `eq(table.organizationId, orgId)`

This prevents cross-organization data access.

### Where are secrets stored?

- **API keys**: Stored encrypted in the `vaultSecrets` table
- **Session tokens**: Hashed with SHA-256 before storage in `sessions` table
- **Passwords**: Hashed with Argon2id (never stored in plaintext)
- **Environment variables**: Never committed to version control

### How do I report a security vulnerability?

See [SECURITY.md](https://github.com/CodesbyFebin/Worker-Agent/blob/main/SECURITY.md) for the coordinated disclosure policy.

**Do NOT** open a public issue for security vulnerabilities. Use GitHub Security Advisories or email security@workeragent.cloud.

## Development

### What is the project structure?

```
Worker-Agent/
├── client/            # React 19 + Vite frontend
├── server/            # Node.js + Express backend
│   ├── _core/         # Core infrastructure (auth, db, etc.)
│   ├── routers/       # tRPC routers (18 total)
│   ├── services/      # Business logic (agents, research, etc.)
│   └── tests/         # Unit + integration tests
├── drizzle/           # Database schema (62 tables)
├── services/          # Python microservices (optional)
├── deployment/        # Production configs (nginx, systemd)
└── docs/              # Documentation (MkDocs + Wiki)
```

### How do I add a new API endpoint?

1. **tRPC**: Add a new procedure to the relevant router in `server/routers/`
2. **REST**: Add a new route to `server/routers/rest.v1.ts` and update OpenAPI spec
3. Update documentation in `docs/architecture/api.md`

### How do I add a new database table?

1. Add the table to `drizzle/schema.ts`
2. Add relations to `drizzle/relations.ts`
3. Run `npx drizzle-kit generate --config=drizzle.config.ts`
4. Commit the generated migration to `drizzle/migrations/`
5. The Schema Guard CI will verify consistency

### How do I contribute?

See [CONTRIBUTING.md](https://github.com/CodesbyFebin/Worker-Agent/blob/main/CONTRIBUTING.md).

Quick summary:
1. Fork the repository
2. Create a branch: `git checkout -b feat/my-feature`
3. Make changes + tests
4. Run CI checks: `npm run typecheck && npm test`
5. Commit with conventional format: `feat: Add my feature`
6. Open a PR

### Where can I find good first issues?

Check the `good first issue` label:
https://github.com/CodesbyFebin/Worker-Agent/issues?q=is%3Aissue+is%3Aopen+label%3A"good+first+issue"

## Troubleshooting

### Why can't I connect to the database?

1. Verify MariaDB is running: `docker compose ps mysql`
2. Check the DATABASE_URL in `.env` matches docker-compose.yml
3. Ensure port 3306 is not already in use: `lsof -i :3306`

### SSE connection fails

1. Verify you're authenticated (check `wa_session` cookie)
2. Check browser console for CORS errors
3. Ensure Nginx has `proxy_buffering off` for `/events`
4. The API server must be accessible from the browser origin

### Dev login fails in development

1. Set `NODE_ENV=development` (or remove it — dev is default)
2. If `NODE_ENV=production` is set, `devLogin` is disabled
3. Use the real `login` procedure with email/password instead

### Rate limiting too aggressive

The default rate limit is 10 requests/minute per IP for authentication.
For local development, you may need to wait or restart the API server.

### Worker doesn't process jobs

1. Check if Redis is running: `docker compose ps redis`
2. Check worker logs: `npm --prefix server run dev:worker`
3. Verify the queue name matches between enqueue and processor

## Billing & Costs

### Is Worker Agent free?

Yes. Worker Agent is open-source (MIT license). You pay only for your infrastructural costs (cloud provider, LLM API usage).

### How are LLM provider costs handled?

Worker Agent routes requests to your configured providers. Costs are billed directly by the provider:
- OpenAI → OpenAI bill
- Anthropic → Anthropic bill
- etc.

Worker Agent does not proxy or charge for LLM usage.

## Roadmap

### What's next for Worker Agent?

See the [Roadmap](./../community/roadmap.md) for the current plan.

We follow a quarterly release cycle. Check [GitHub Releases](https://github.com/CodesbyFebin/Worker-Agent/releases) for the latest.

## Still have questions?

- 💬 [GitHub Discussions](https://github.com/CodesbyFebin/Worker-Agent/discussions) — Ask the community
- 🐛 [GitHub Issues](https://github.com/CodesbyFebin/Worker-Agent/issues) — Report bugs
- 📧 For enterprise inquiries, open a Discussion