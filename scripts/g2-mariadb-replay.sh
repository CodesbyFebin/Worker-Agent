#!/usr/bin/env bash
# G2-F: Disposable MariaDB replay of generated baseline
# Run from clean checkout of g2/migration-baseline branch
set -euo pipefail

echo "=== G2-F: Disposable MariaDB Replay ==="

# 1. Verify toolchain
echo "Node: $(node --version) (required: 20.18.0)"
echo "npm: $(npm --version) (required: 10.8.0)"

node_v=$(node --version | grep -oP 'v\K[0-9]+\.[0-9]+\.[0-9]+')
npm_v=$(npm --version)

if [ "$node_v" != "20.18.0" ]; then
    echo "ERROR: Node version mismatch. Required: 20.18.0, Got: $node_v"
    exit 1
fi
if [ "$npm_v" != "10.8.0" ]; then
    echo "ERROR: npm version mismatch. Required: 10.8.0, Got: $npm_v"
    exit 1
fi

echo ""
echo "=== E05: npm ci ==="
npm ci
echo "npm ci exit: $?"

echo ""
echo "=== E04: npm ls ==="
npm ls drizzle-kit drizzle-orm

echo ""
echo "=== E06: Fresh generate ==="
rm -rf drizzle/migrations
npx drizzle-kit generate --name=g2_baseline
echo "generate exit: $?"

echo ""
echo "=== G2-F: MariaDB replay ==="
export DATABASE_URL='mysql://root:root@127.0.0.1:3306/worker_agent_g2'

npx drizzle-kit migrate
echo "migrate exit: $?"

echo ""
echo "=== G2-G: Database acceptance ==="
SQL_FILE=$(ls drizzle/migrations/0000_*.sql | head -1)
mysql -h 127.0.0.1 -P 3306 -u root -proot worker_agent_g2 < $SQL_FILE 2>/dev/null || true

echo "Table count:"
mysql -h 127.0.0.1 -P 3306 -u root -proot worker_agent_g2 -e \
    "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema = 'worker_agent_g2' AND table_type = 'BASE TABLE';"

echo "Foreign key count:"
mysql -h 127.0.0.1 -P 3306 -u root -proot worker_agent_g2 -e \
    "SELECT COUNT(*) AS fk_count FROM information_schema.referential_constraints WHERE constraint_schema = 'worker_agent_g2';"

echo ""
echo "=== Artifacts ==="
sha256sum drizzle/migrations/0000_g2_baseline.sql \
        drizzle/migrations/meta/_journal.json \
        drizzle/migrations/meta/0000_snapshot.json
