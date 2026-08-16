import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const distDir = join(import.meta.dirname, "..", "server", "dist");

function fixFile(filepath) {
  let content = readFileSync(filepath, "utf8");
  const fileDir = dirname(filepath);

  function resolver(path) {
    if (path.endsWith(".js") || path.endsWith(".json")) return null;
    const resolvedDir = join(fileDir, path, "index.js");
    if (existsSync(resolvedDir)) return `${path}/index.js`;
    if (existsSync(join(fileDir, path + ".js"))) return `${path}.js`;
    if (existsSync(join(fileDir, path + ".ts"))) return `${path}.js`;
    if (existsSync(join(fileDir, path, "index.ts"))) return `${path}/index.js`;
    return path.startsWith(".") ? `${path}.js` : null;
  }

  // Fix static imports/exports
  content = content.replace(
    /from\s+(["'])(\.\.?\/[^"']+)\1/g,
    (match, quote, path) => {
      const resolved = resolver(path);
      return resolved ? `from ${quote}${resolved}${quote}` : match;
    }
  );
  content = content.replace(
    /export\s+\*\s+from\s+(["'])(\.\.?\/[^"']+)\1/g,
    (match, quote, path) => {
      const resolved = resolver(path);
      return resolved ? `export * from ${quote}${resolved}${quote}` : match;
    }
  );

  // Fix dynamic imports
  content = content.replace(
    /import\s*\(\s*(["'])(\.\.?\/[^"']+)\1\s*\)/g,
    (match, quote, path) => {
      const resolved = resolver(path);
      return resolved ? `import(${quote}${resolved}${quote})` : match;
    }
  );

  // Fix logger Invalid time value
  content = content.replace(
    "ts: new Date(log.ts).toISOString(),",
    "ts: log.ts ? new Date(log.ts).toISOString() : new Date().toISOString(),"
  );

  writeFileSync(filepath, content);
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) fixFile(full);
  }
}

walk(distDir);
console.log("Fixed ESM imports in compiled server output");
