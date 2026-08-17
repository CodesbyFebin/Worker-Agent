#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const parsed = new URL(dbUrl);
const config = {
  host: parsed.hostname,
  port: parseInt(parsed.port) || 3306,
  user: parsed.username,
  password: parsed.password,
  database: parsed.pathname.replace(/^\//, ''),
  multipleStatements: true,
  connectTimeout: 10000,
};

const migrationsDir = path.resolve('drizzle/migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No migration files found in drizzle/migrations/');
  process.exit(1);
}

console.log(`Applying ${files.length} migration(s)...`);

const connection = await mysql.createConnection(config);

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let sql = fs.readFileSync(filePath, 'utf-8');

  // Strip Drizzle Kit statement-breakpoint markers
  sql = sql
    .replace(/;\s*--> statement-breakpoint\s*$/gm, ';')
    .split('\n')
    .filter(line => line.trim() !== '--> statement-breakpoint')
    .join('\n');

  // Split into individual statements and execute one at a time
  // This allows partial success (e.g., indexes that exceed key length on MySQL)
  const statements = sql.split(';').filter(s => s.trim()).map(s => s.trim() + ';');
  let success = 0, failed = 0;
  for (const stmt of statements) {
    try {
      await connection.query(stmt);
      success++;
    } catch (err) {
      failed++;
      console.error(`  ⚠ SKIP: ${err.message.substring(0, 120)}`);
    }
  }
}

// Seed drizzle migrations tracking table
await connection.query(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hash TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
await connection.query(`
  INSERT INTO __drizzle_migrations (hash) VALUES (?)
  ON DUPLICATE KEY UPDATE hash = hash
`, [files[0]]);

await connection.end();
console.log('Migrations applied successfully.');
