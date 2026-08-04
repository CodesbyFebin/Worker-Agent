import fs from "fs/promises";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { TRPCError } from "@trpc/server";
import { assertSafeRelativePath } from "../../_core/sandbox";

const SKIP = new Set([
  "node_modules",
  ".git",
  ".worktrees",
  ".artifacts",
  ".local",
  "dist",
  "coverage",
  ".turbo",
]);

function detectRepoRoot(): string {
  if (process.env.GOD_MACHINE_REPO_ROOT) {
    return path.resolve(process.env.GOD_MACHINE_REPO_ROOT);
  }
  // npm workspace `dev` often runs with cwd=server/ — walk up for monorepo root.
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "package.json");
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
          name?: string;
          workspaces?: unknown;
        };
        if (pkg.name === "worker-agent-cloud" || pkg.workspaces) return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Same root agents use for worktrees — override with GOD_MACHINE_REPO_ROOT. */
export function repoRoot(): string {
  return detectRepoRoot();
}

function resolveSafe(rel: string): string {
  const root = repoRoot();
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  try {
    if (cleaned) assertSafeRelativePath(cleaned);
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err instanceof Error ? err.message : "Sandbox path rejected",
    });
  }
  const abs = path.resolve(root, cleaned);
  const relToRoot = path.relative(root, abs);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Path escapes repository root" });
  }
  return abs;
}

export async function listRepoDir(relPath: string): Promise<{
  root: string;
  path: string;
  entries: Array<{ name: string; path: string; kind: "file" | "dir" }>;
}> {
  const root = repoRoot();
  const abs = resolveSafe(relPath);
  let dirents;
  try {
    dirents = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    throw new TRPCError({ code: "NOT_FOUND", message: `Directory not found: ${relPath || "/"}` });
  }

  const entries = dirents
    .filter((d) => !SKIP.has(d.name) && !d.name.startsWith("."))
    .map((d) => ({
      name: d.name,
      path: path.posix.join(relPath.replace(/\\/g, "/"), d.name).replace(/^\//, ""),
      kind: (d.isDirectory() ? "dir" : "file") as "file" | "dir",
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { root, path: relPath, entries };
}

const MAX_BYTES = 200_000;

export async function readRepoFile(relPath: string): Promise<{
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}> {
  const abs = resolveSafe(relPath);
  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    throw new TRPCError({ code: "NOT_FOUND", message: `File not found: ${relPath}` });
  }
  if (!stat.isFile()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Not a file" });
  }
  if (stat.size > MAX_BYTES * 4) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File too large to preview (${stat.size} bytes)`,
    });
  }
  const buf = await fs.readFile(abs);
  // Reject obvious binaries
  if (buf.includes(0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Binary file — cannot preview" });
  }
  const text = buf.toString("utf8");
  const truncated = text.length > MAX_BYTES;
  return {
    path: relPath,
    content: truncated ? text.slice(0, MAX_BYTES) : text,
    truncated,
    size: stat.size,
  };
}

/** Write UTF-8 text into a file under the repo root (path-traversal safe). */
export async function writeRepoFile(
  relPath: string,
  content: string,
): Promise<{ path: string; size: number }> {
  if (content.length > MAX_BYTES * 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Content too large (${content.length} chars)`,
    });
  }
  const abs = resolveSafe(relPath);
  const root = repoRoot();
  // Disallow writing into skipped system dirs
  const first = relPath.replace(/\\/g, "/").split("/").filter(Boolean)[0];
  if (first && SKIP.has(first)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot write under ${first}/` });
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  const stat = await fs.stat(abs);
  return { path: path.relative(root, abs).replace(/\\/g, "/"), size: stat.size };
}

export { resolveSafe };

