# Production Deployment (systemd + Nginx)

For production environments, Worker Agent supports native systemd deployments with Nginx reverse proxy.

## Architecture

```
Internet → Nginx (:443) → API (:4000) → MariaDB + Redis
                        ↘ Worker (:4000)
```

## Quick Deploy

```bash
# Run the bootstrap script
bash deployment/scripts/bootstrap.sh

# Edit configuration
sudo nano /etc/worker-agent.env

# Start services
sudo systemctl enable --now worker-agent-api
sudo systemctl enable --now worker-agent-worker

# Apply database baseline
sudo docker-compose exec api npx drizzle-kit db:push --config=drizzle.config.ts
```

## Manual Setup

### 1. Build

```bash
npm install
npm --prefix server run build
npm --prefix client run build
```

### 2. Configure

```bash
cp .env.example /etc/worker-agent.env
nano /etc/worker-agent.env
```

### 3. Install Services

```bash
sudo cp deployment/systemd/worker-agent-api.service /etc/systemd/system/
sudo cp deployment/systemd/worker-agent-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now worker-agent-api worker-agent-worker
```

### 4. Configure Nginx

```bash
sudo cp deployment/nginx/workeragent-cloud.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/workeragent-cloud /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Health Checks

- **Liveness**: `GET /health`
- **Readiness**: `GET /ready` (checks DB + Redis)

## Backups

```bash
bash deployment/scripts/backup.sh    # Create backup
bash deployment/scripts/restore.sh <file>  # Restore
```