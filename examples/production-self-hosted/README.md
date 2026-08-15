# Production Self-Hosted Example

Full production deployment with Docker Compose, reverse proxy, TLS, and monitoring.

## What This Example Shows

- Production-grade Docker Compose
- Nginx reverse proxy with TLS
- MariaDB with persistence
- Redis with persistence
- Systemd service units
- Backup and restore scripts
- Monitoring configuration

## Prerequisites

- Ubuntu 22.04+ VPS (or compatible)
- Domain name (e.g., agent.yourcompany.com)
- Ports 80, 443 available

## Quick Deploy

```bash
# 1. Clone and configure
cp .env.example .env.production
# Edit values in .env.production

# 2. Bootstrap the server
./scripts/bootstrap.sh

# 3. Deploy
docker compose -f docker-compose.prod.yml up -d

# 4. Verify
curl https://agent.yourcompany.com/health
# Expected: {"status":"ok"}
```

## Directory Structure

```
production-self-hosted/
├── docker-compose.prod.yml   # Production compose file
├── nginx/
│   ├── nginx.conf           # Reverse proxy config
│   └── ssl/                 # TLS certificates (mounted)
├── mariadb/                 # Database persistence volume
├── redis/                   # Redis persistence volume
├── scripts/
│   ├── bootstrap.sh         # Server setup automation
│   ├── backup.sh            # Database backups
│   └── restore.sh           # Restore from backup
└── monitoring/
    ├── prometheus.yml       # Metrics collection
    └── grafana-dashboard.json
```

## docker-compose.prod.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - nginx-cache:/var/cache/nginx
    depends_on:
      - api
    restart: unless-stopped

  api:
    image: ghcr.io/worker-agent/api:latest
    env_file: .env.production
    volumes:
      - api-storage:/app/storage
    expose:
      - '4000'
    depends_on:
      - database
      - redis
    restart: unless-stopped

  worker:
    image: ghcr.io/worker-agent/worker:latest
    env_file: .env.production
    volumes:
      - api-storage:/app/storage
    depends_on:
      - database
      - redis
    restart: unless-stopped

  database:
    image: mariadb:10.11
    env_file: .env.production
    volumes:
      - ./mariadb/data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - ./redis/data:/data
    restart: unless-stopped

volumes:
  api-storage:
  nginx-cache:
```

## bootstrap.sh (Key Steps)

The script automates server setup:

1. Installs Docker and Docker Compose
2. Sets up TLS via Let's Encrypt
3. Configures firewall (UFW)
4. Creates systemd service
5. Downloads production images
6. Starts all services

## Monitoring

Prometheus scrapes metrics from:

- **API**: `http://localhost:4000/metrics`
- **Workers**: Via BullMQ dashboard
- **System**: Node exporter for host metrics

Grafana dashboard available at `http://localhost:3000/dashboards`

## Backup Strategy

```bash
# Automated daily backups
./scripts/backup.sh

# Backup contents:
# - Database dump (full SQL)
# - Redis RDB snapshot
# - Environment configuration
# - Application storage files

# Restore from backup
./scripts/restore.sh YYYY-MM-DD
```

## Scaling

To scale the worker:

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=3
```

To scale the API:

```bash
docker compose -f docker-compose.prod.yml up -d --scale api=2
```

## Security Notes

- All credentials in `.env.production` (never in version control)
- TLS enforced via Nginx redirect
- Security headers configured in Nginx
- Rate limiting via Nginx `limit_req_zone`
- Database port only accessible internally
- Redis protected with ACL

## Related Examples

- [basic-agent](../basic-agent/) — Development setup
- [provider-example](../provider-example/) — Adding providers