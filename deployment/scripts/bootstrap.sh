#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Worker Agent Cloud — Bootstrap Script
# Provisions a production server: deps, DB schema, systemd.
# ============================================================

echo "=== Worker Agent Cloud Bootstrap ==="
echo "Platform: $(uname -a)"

# --- Config ---
APP_DIR="/opt/worker-agent"
APP_USER="worker-agent"
SERVICE_FILE_API="worker-agent-api.service"
SERVICE_FILE_WORKER="worker-agent-worker.service"

# --- Check root ---
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: Run as root (sudo)"
    exit 1
fi

# --- Create app user ---
if ! id "$APP_USER" &>/dev/null; then
    echo "--- Creating user: $APP_USER"
    useradd --system --create-home --shell /bin/false "$APP_USER"
fi

# --- Create directories ---
echo "--- Creating directories..."
mkdir -p "$APP_DIR/server"
mkdir -p "$APP_DIR/client"
mkdir -p "$APP_DIR/deployment/rc1"
mkdir -p "$APP_DIR/deployment/nginx"
mkdir -p "$APP_DIR/deployment/systemd"
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/src"

# --- Install system dependencies ---
echo "--- Installing system dependencies..."
if command -v apt-get &>/dev/null; then
    apt-get update
    apt-get install -y curl ca-certificates gnupg lsb-release nginx postgresql-client redis-tools
elif command -v yum &>/dev/null; then
    yum install -y curl nginx postgresql redis
fi

# --- Install Node.js ---
if ! command -v node &>/dev/null; then
    echo "--- Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# --- Install PM2 ---
if ! command -v pm2 &>/dev/null; then
    echo "--- Installing PM2..."
    npm install -g pm2
fi

# --- Database ---
echo "--- Loading database schema..."
if [[ -f "$APP_DIR/deployment/rc1/001_worker_agent_baseline.sql" ]]; then
    PGPASSWORD="${DB_PASSWORD:-}" psql \
        -h "${DB_HOST:-localhost}" \
        -U "${DB_USER:-worker_agent}" \
        -d "${DB_NAME:-worker_agent}" \
        -f "$APP_DIR/deployment/rc1/001_worker_agent_baseline.sql" \
        || echo "WARNING: Schema load failed — verify DB connection"
fi

# --- Verify schema ---
if [[ -f "$APP_DIR/deployment/rc1/verify-schema.sql" ]]; then
    echo "--- Verifying schema..."
    PGPASSWORD="${DB_PASSWORD:-}" psql \
        -h "${DB_HOST:-localhost}" \
        -U "${DB_USER:-worker_agent}" \
        -d "${DB_NAME:-worker_agent}" \
        -f "$APP_DIR/deployment/rc1/verify-schema.sql"
fi

# --- Nginx config ---
echo "--- Installing Nginx config..."
NGINX_CONF="/etc/nginx/sites-available/worker-agent"
if [[ -f "$APP_DIR/deployment/nginx/worker-agent.conf" ]]; then
    cp "$APP_DIR/deployment/nginx/worker-agent.conf" "$NGINX_CONF"
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/worker-agent
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
fi

# --- Systemd services ---
echo "--- Installing systemd services..."
for svc in "$SERVICE_FILE_API" "$SERVICE_FILE_WORKER"; do
    if [[ -f "$APP_DIR/deployment/systemd/$svc" ]]; then
        cp "$APP_DIR/deployment/systemd/$svc" "/etc/systemd/system/$svc"
    fi
done

systemctl daemon-reload
systemctl enable "$SERVICE_FILE_API"
systemctl enable "$SERVICE_FILE_WORKER"
systemctl start "$SERVICE_FILE_API"
systemctl start "$SERVICE_FILE_WORKER"

# --- Summary ---
echo ""
echo "=== Bootstrap complete ==="
echo "App dir:  $APP_DIR"
echo "API logs: journalctl -u $SERVICE_FILE_API -f"
echo "Worker:   journalctl -u $SERVICE_FILE_WORKER -f"
echo "Nginx:    systemctl status nginx"
echo ""
echo "Next steps:"
echo "  1. Create .env.production from deployment/rc1/env.template"
echo "  2. Obtain SSL cert (certbot --nginx -d workeragent.cloud)"
echo "  3. Set up PostgreSQL and Redis"
echo "  4. Deploy built client to $APP_DIR/client/dist"
echo "  5. Visit https://workeragent.cloud"
