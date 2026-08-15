# Worker Agent — Nginx Reverse Proxy Configuration (README)
#
# Usage:
#   sudo cp workeragent-cloud.conf /etc/nginx/sites-available/workeragent-cloud
#   sudo ln -s /etc/nginx/sites-available/workeragent-cloud /etc/nginx/sites-enabled/
#   sudo nginx -t && sudo systemctl reload nginx
#
# This configuration provides:
#   - HTTP to HTTPS redirect
#   - SSL/TLS termination
#   - Security headers (nosniff, frame-options, referrer-policy)
#   - Static asset caching (30 days)
#   - API proxy (tRPC, REST, webhooks) to :4000
#   - SSE proxy (/events) with no buffering
#   - Health/readiness probe endpoints
#   - Metrics endpoint restricted to internal network
#   - SPA fallback for client-side routing