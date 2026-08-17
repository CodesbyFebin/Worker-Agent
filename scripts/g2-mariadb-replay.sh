#!/usr/bin/env bash
# G2-F: Disposable MariaDB replay of generated baseline
# Run from clean checkout of g2/migration-baseline branch
set -euo pipefail

echo "=== G2-F: Disposable MariaDB Replay ==="

# 1. Verify toolchain
echo "Node: $(node --version) (target: 20.18.0)"
echo "npm: $(npm --version) (target: 10.8.0)"

echo ""
echo "=== E05: npm ci ==="
npm ci
echo "npm ci exit: $?"

echo ""
echo "=== E04: npm ls ==="
npm ls drizzle-kit drizzle-orm

echo ""
echo "=== G2-F: MariaDB replay ==="
export DATABASE_URL='mysql://root:root@127.0.0.1:3306/worker_agent_g2'

npm run db:migrate
echo "migrate exit: $?"

echo ""
echo "=== G2-G: Database acceptance ==="
SQL_FILE=$(ls drizzle/migrations/0000_*.sql | head -1)

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

echo "=== G2-F/G: REPLAY COMPLETE ==="
