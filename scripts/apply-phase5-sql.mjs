import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "../drizzle/sql/phase5_agent_runtime.sql");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const cleaned = sql
  .split("\n")
  .map((line) => (line.trimStart().startsWith("--") ? "" : line))
  .join("\n");
const parts = cleaned
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 10);

const conn = await mysql.createConnection(url);
console.log(`Applying ${parts.length} statements from phase5_agent_runtime.sql`);
for (const stmt of parts) {
  try {
    await conn.query(stmt);
    console.log("OK", stmt.slice(0, 48).replace(/\s+/g, " "));
  } catch (err) {
    const e = err && typeof err === "object" ? err : { message: String(err) };
    console.error("ERR", e.code ?? e.message, stmt.slice(0, 48).replace(/\s+/g, " "));
  }
}
const [rows] = await conn.query("SHOW TABLES LIKE 'agent_%'");
console.log("agent_* tables:", rows);
await conn.end();
