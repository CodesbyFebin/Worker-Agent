# Troubleshooting

## Common Issues

### 1. "Connection refused" on /trpc

The API server is not running or unreachable.

**Check:**
```bash
sudo systemctl status worker-agent-api
curl http://localhost:4000/health
```

### 2. Database connection failed

MariaDB/MySQL is not running or credentials are wrong.

**Check:**
```bash
sudo systemctl status mysql
mysql -u root -p worker_agent -e "SELECT 1"
```

Update `DATABASE_URL` in `/etc/worker-agent.env`.

### 3. "Cannot connect to Redis"

Redis is not running.

**Check:**
```bash
redis-cli ping
```

### 4. Session cookie not working

Ensure:
- `SESSION_SECRET` is set and consistent across restarts
- `CLIENT_ORIGIN` matches your Nginx URL
- Cookies are set with `Secure` flag (requires HTTPS)

### 5. SSE connection fails

Ensure Nginx is configured with `proxy_buffering off` for `/events`.

### 6. Schema Guard failing

If you see "SCHEMA DRIFT DETECTED!":

```bash
# Regenerate migrations
npx drizzle-kit generate --config=drizzle.config.ts

# Commit the generated files
git add drizzle/migrations/
git commit -m "chore(db): regenerate migrations"
```

## Logs

```bash
# API logs
sudo journalctl -u worker-agent-api -f

# Worker logs
sudo journalctl -u worker-agent-worker -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```