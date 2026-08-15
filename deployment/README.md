# Worker Agent Cloud — Deployment Guide

Production deployment documentation for **Worker Agent.Cloud** — the autonomous operating system for AI content networks.

## Quick Start

```bash
# Build
npm run build

# Bootstrap server (installs deps, loads DB schema, configures nginx)
sudo bash deployment/scripts/bootstrap.sh

# Start services
sudo systemctl start worker-agent-api
sudo systemctl start worker-agent-worker
```

## Architecture

| Component   | Description                                              |
|------------|-----------------------------------------------------------|
| Nginx      | TLS termination, security headers, reverse proxy to API + web |
| API        | Bun/Elysia server — tRPC routers, REST API, SSE streams  |
| Worker     | Background process for AI agent execution and pipelines   |
| PostgreSQL | Primary database (schema in `rc1/001_worker_agent_baseline.sql`) |
| Redis      | Rate-limiting, job queues, session cache                   |

## Ports

| Service   | Port  |
|----------|-------|
| Nginx    | 80/443 |
| API      | 3001  |
| Client   | 5173 (dev) / served by Nginx (prod) |
| PostgreSQL | 5432 |
| Redis    | 6379  |

## Directory Structure

```
deployment/
├── rc1/
│   ├── 001_worker_agent_baseline.sql   # PostgreSQL schema baseline
│   ├── verify-schema.sql                # Schema verification script
│   └── env.template                     # Production environment template
├── nginx/
│   └── worker-agent.conf                # Nginx reverse proxy config
├── systemd/
│   ├── worker-agent-api.service         # API systemd unit
│   └── worker-agent-worker.service      # Worker systemd unit
└── scripts/
    └── bootstrap.sh                       # Server bootstrap script
```

## Bootstrap Script

`scripts/bootstrap.sh` performs:

1. Creates `worker-agent` system user
2. Creates directory structure under `/opt/worker-agent/`
3. Installs system dependencies (nginx, postgresql-client, redis-tools)
4. Installs Node.js 20.x (if not present)
5. Installs PM2 globally
6. Loads SQL baseline into PostgreSQL
7. Verifies schema integrity
8. Installs Nginx config and starts/reloads
9. Installs and enables systemd services

**Requirements:**

- Root or sudo access
- PostgreSQL running and accessible
- Redis running and accessible
- Domain `workeragent.cloud` pointed at this server

## Environment Configuration

Copy `deployment/rc1/env.template` to `.env.production` and fill in:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `BETTER_AUTH_SECRET` — Long random string for session signing
- AI provider API keys (at least one required)
- OAuth credentials (GitHub, Google, Microsoft)
- Storage credentials (S3-compatible)
- Email/SMS provider keys

## SSL / TLS

The Nginx config expects certificates at:

```
/etc/ssl/certs/workeragent.cloud/fullchain.pem
/etc/ssl/private/workeragent.cloud/privkey.pem
```

Use Certbot to obtain Let's Encrypt certificates:

```bash
certbot --nginx -d workeragent.cloud -d www.workeragent.cloud
```

## Systemd Services

### API Server

```bash
sudo systemctl start worker-agent-api
sudo journalctl -u worker-agent-api -f     # logs
sudo systemctl status worker-agent-api       # status
```

### Background Worker

```bash
sudo systemctl start worker-agent-worker
sudo journalctl -u worker-agent-worker -f
sudo systemctl status worker-agent-worker
```

## Health Checks

```bash
curl https://workeragent.cloud/api/health
```

Expected response: `{"status":"ok","timestamp":"..."}`

## Database Migrations

Schema baseline:

```bash
psql $DATABASE_URL -f deployment/rc1/001_worker_agent_baseline.sql
psql $DATABASE_URL -f deployment/rc1/verify-schema.sql
```

Drizzle ORM migrations (for incremental changes):

```bash
npm run db:push      # push schema changes
npm run db:generate  # generate migration files
```

## Backups

```bash
# Database
pg_dump $DATABASE_URL > backup_$(date +%F).sql

# Application data
tar czf backup_$(date +%F).tar.gz /opt/worker-agent
```

## Rollback

```bash
# Stop services
sudo systemctl stop worker-agent-api worker-agent-worker

# Restore database
psql $DATABASE_URL < backup.sql

# Restore app
cd /opt/worker-agent && tar xzf backup.tar.gz

# Start services
sudo systemctl start worker-agent-api worker-agent-worker
```

## Monitoring

- API and worker logs: `journalctl -u worker-agent-api -f` / `journalctl -u worker-agent-worker -f`
- System metrics: `htop`, `docker stats` (if containerized)
- Database: `psql $DATABASE_URL -c "SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 50"`
- Redis: `redis-cli monitor`

## Scaling

For horizontal scaling, add multiple API replicas behind Nginx:

1. Start additional API instances on ports 3001, 3002, etc.
2. Update Nginx upstream block
3. Ensure Redis is used for session storage (not in-process)
4. Ensure all replicas share the same PostgreSQL database
