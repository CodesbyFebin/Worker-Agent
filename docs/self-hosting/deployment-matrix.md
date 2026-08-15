# Deployment Matrix

## Environment Comparison

| Component | Local (Dev) | Docker Compose | Docker Swarm | VPS/Production |
|-----------|-------------|----------------|--------------|-----------------|
| **Frontend** | Vite (port 5173) | Nginx (port 80) | Nginx | Nginx |
| **API** | Express (port 4000) | Node (port 4000) | Node cluster | Node cluster (PM2/Bun) |
| **Worker** | Node (port 4001) | Node (port 4001) | Node worker service | Node worker service |
| **Database** | MariaDB (port 3306) | MariaDB container | External MySQL 8.0+ | MariaDB 10.11+ |
| **Redis** | Redis (port 6379) | Redis container | External Redis 7.0+ | Redis w/ persistence |
| **SMTP** | Disabled (logs to stdout) | Mailpit (port 1025) | External SMTP | SMTP relay |
| **Storage** | Local filesystem | Local volume | Shared volume/NFS | External S3-compatible |

## Port Mapping

### Local Development

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | Vite dev server |
| API | 4000 | Express API |
| Worker | 4001 | BullMQ worker |
| WebSocket | 4002 | Socket.io (if used) |
| SSE | 4000 | Same as API |
| Database | 3306 | MariaDB |
| Redis | 6379 | Redis server |
| Mailpit | 1025 | SMTP mock |
| Mailpit UI | 8025 | Mailpit web UI |

### Docker Compose

| Service | Port | Purpose |
|---------|------|---------|
| Nginx | 80 | Reverse proxy |
| API | 4000 | Internal only |
| Worker | 4001 | Internal only |
| MySQL | 3306 | Internal only |
| Redis | 6379 | Internal only |

### Production (VPS)

| Service | Port | Purpose |
|---------|------|---------|
| Nginx | 80/443 | Reverse proxy + TLS |
| API | 4000 | Internal (loopback) |
| Worker | 4001 | Internal (loopback) |
| SSH | 22 | Server access |
| Prometheus | 9090 | Metrics (if self-hosted) |

## Scaling Options

### Horizontal Scaling

| Service | Scale | Notes |
|---------|-------|-------|
| API | Yes | Stateless, share Redis sessions |
| Worker | Yes | Separate queues per org recommended |
| Database | No | Use external clustered DB |
| Redis | No | Use external Redis cluster |

### Vertical Scaling

| Resource | Min | Recommended | Max |
|----------|-----|-------------|-----|
| CPU | 2 cores | 4-8 cores | 16 cores |
| RAM | 4GB | 8-16GB | 64GB |
| Disk | 20GB SSD | 100GB SSD | 500GB SSD+ |
| Database Storage | 50GB | 200GB | 2TB |

## Configuration by Environment

| Setting | Local | Docker | Production |
|---------|-------|--------|------------|
| `SESSION_SECRET` | Auto-generated | Random env var | Vault-managed |
| `DATABASE_URL` | `mysql://localhost` | Container name | External cluster |
| `REDIS_URL` | `redis://localhost` | Container name | External cluster |
| `SMTP_SECURE` | false | false (Mailpit) | true (relai) |
| `LOG_LEVEL` | debug | info | warn |
| `ENABLE_CORS` | true | false | false |
| `RATE_LIMIT_ENABLED` | false | true | true |

## Recommended Production Stack

```
Cloud Provider: AWS / Hetzner / DigitalOcean
Instance: 4 vCPU, 8GB RAM, 100GB SSD
Load Balancer: NGINX or AWS ALB
Database: External managed MySQL 8.0
Redis: External managed Redis 7.x
Monitoring: Prometheus + Grafana
Logging: Loki + Promtail
Backup: Daily database snapshots
```