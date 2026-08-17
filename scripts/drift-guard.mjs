#!/usr/bin/env node
/**
 * Migration drift guard.
 * Verifies that the committed Drizzle migration SQL matches the
 * declarative schema in drizzle/schema.ts without needing drizzle-kit.
 */
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.resolve('drizzle/schema.ts');
const MIGRATIONS_DIR = path.resolve('drizzle/migrations');

function getTableNames(content, pattern) {
  const tables = new Set();
  const re = new RegExp(pattern, 'g');
  for (const m of content.matchAll(re)) {
    if (m[1] !== '__drizzle_migrations') {
      tables.add(m[1]);
    }
  }
  return tables;
}

// Verify schema.ts exists
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error('CRITICAL: drizzle/schema.ts not found');
  process.exit(1);
}

const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
const schemaTables = getTableNames(schema, 'mysqlTable\\(\\s*[\\x27\\x22`](\\w+)[\\x27\\x22`]');

// Find committed migration files
const migrationFiles = fs.existsSync(MIGRATIONS_DIR)
  ? fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  : [];

if (migrationFiles.length === 0) {
  console.error('CRITICAL: No migration files found in drizzle/migrations/');
  process.exit(1);
}

const journalPath = path.join(MIGRATIONS_DIR, 'meta', '_journal.json');
if (!fs.existsSync(journalPath)) {
  console.error('CRITICAL: Migration journal (_journal.json) not found');
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
console.log('[DRIFT GUARD] Journal tag: ' + (journal.tag || 'unknown'));

let allMigrationTables = new Set();
for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
  const tables = getTableNames(sql, 'CREATE TABLE\\s+[\\x27\\x22`]?((\\w+))[\\x27\\x22`]?');
  for (const t of tables) allMigrationTables.add(t);
}

const missing = [...schemaTables].filter(t => !allMigrationTables.has(t));
const extra = [...allMigrationTables].filter(t => !schemaTables.has(t));

console.log('[DRIFT GUARD] Schema tables: ' + schemaTables.size);
console.log('[DRIFT GUARD] Migration tables: ' + allMigrationTables.size);

if (missing.length > 0) {
  console.error('CRITICAL: DRIFT — Tables in schema.ts but NOT in migration:');
  console.error('  ' + missing.join('\n  '));
  process.exit(1);
}

if (extra.length > 0) {
  console.error('WARN: Tables in migration but not in schema.ts:');
  console.error('  ' + extra.join('\n  '));
}

console.log('PASS: Migration drift check PASSED');
