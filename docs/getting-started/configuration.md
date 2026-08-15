# Configuration

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

### Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | MariaDB/MySQL connection string | `mysql://user:pass@localhost:3306/worker_agent` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SESSION_SECRET` | Session signing secret (32+ chars) | `openssl rand -hex 32` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | `sk-...` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API server port |
| `NODE_ENV` | `development` | `production` or `development` |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Vite client origin |
| `RATE_LIMIT_MAX` | `300` | Max API requests per minute |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | — | OpenTelemetry endpoint |

## Database Bootstrap

```bash
# Generate and apply schema
npx drizzle-kit generate --config=drizzle.config.ts
npx drizzle-kit db:push --config=drizzle.config.ts
```

## Auth Bootstrap

Production authentication is enabled by default. For development:

```bash
# Dev login (disabled in production)
curl -X POST http://localhost:4000/trpc/auth.devLogin -H "Content-Type: application/json"
```
