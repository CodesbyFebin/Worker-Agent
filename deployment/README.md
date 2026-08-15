# Self-Hosted Deployment

Worker Agent provides multiple deployment options. Choose the one that fits your infrastructure:

## Quick Start (Docker Compose)

The fastest path to a running instance:

```bash
# Clone and configure
git clone https://github.com/CodesbyFebin/Worker-Agent.git
cd Worker-Agent
cp .env.example .env
# Edit .env with your API keys and database URL

# Start all services
docker-compose up -d

# Apply database baseline (RC-1 Gate)
docker-compose exec api npx drizzle-kit db:push --config=drizzle.config.ts

# Verify
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

## Production Deployment (systemd + Nginx)

For production, use Nginx as a reverse proxy and systemd for process management:

```bash
# Run the bootstrap script (creates user, clones repo, generates secrets)
curl -sSL https://raw.githubusercontent.com/CodesbyFebin/Worker-Agent/main/deployment/scripts/bootstrap.sh | bash

# Edit configuration
sudo nano /opt/worker-agent/.env

# Copy systemd service files
sudo cp deployment/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload

# Start services
sudo systemctl enable --now mysql redis-server
sudo systemctl enable --now worker-agent-api
sudo systemctl enable --now worker-agent-worker

# Copy nginx config (after setting up TLS)
sudo cp deployment/nginx/workeragent-cloud.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/workeragent-cloud /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Environment Variables

All runtime configuration is via environment variables. See `.env.example` for the complete reference.

### Critical Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MariaDB/MySQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Random 32-byte hex for session signing |
| `ENCRYPTION_KEY` | Random 32-byte hex for secret encryption |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `NODE_ENV` | `production` or `development` |
| `PORT` | API server port (default: 4000) |
| `CLIENT_ORIGIN` | Vite client origin for CORS |

### Service Ports

| Port | Service |
|---|---|
| 4000 | API server (tRPC + REST + SSE) |
| 5173 | Vite client (dev) / Nginx (prod) |
| 3306 | MariaDB |
| 6379 | Redis |
| 3000 | OAuth callback (setup only) |

## Health Checks

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check — process is alive |
| `GET /ready` | Readiness check — verifies DB + Redis connectivity |
| `GET /metrics` | Prometheus metrics endpoint |

## Backup & Restore

```bash
# Backup
bash deployment/scripts/backup.sh

# Restore (requires confirmation)
bash deployment/scripts/restore.sh backups/backup_20240115_120000.sql.gz
```

## TLS / HTTPS

Worker Agent must run behind TLS in production. Use your preferred method:
- **Certbot**: `sudo certbot --nginx -d your-domain.com`
- **Cloudflare**: Proxy mode with Full SSL
- **Manual**: Place certificates and update `deployment/nginx/workeragent-cloud.conf`

## Security Notes

- Never expose port 4000 directly — always use Nginx
- Restrict `/metrics` to internal network
- Use strong, unique passwords for all services
- Rotate `SESSION_SECRET` and `ENCRYPTION_KEY` periodically
- Enable firewall rules for database and Redis ports
- Set up automated backups with `deployment/scripts/backup.sh`