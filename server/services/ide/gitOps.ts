import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import { isNull, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../../_core/db";
import { agentWorktrees, agentTasks } from "../../../drizzle/schema";
import { repoRoot } from "./repoFs";
import { openPullRequest } from "../vcs/github";
import { env } from "../../_core/env";

const execFileAsync = promisify(execFile);

async function resolveGitBin(): Promise<string | null> {
  const candidates = [
    process.env.GIT_PATH,
    "git",
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\bin\\git.exe",
  ].filter(Boolean) as string[];
  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ["--version"]);
      return bin;
    } catch {
      /* next */
    }
  }
  return null;
}

async function runGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const git = await resolveGitBin();
  if (!git) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "git not found (set GIT_PATH)" });
  try {
    const { stdout, stderr } = await execFileAsync(git, args, {
      cwd: cwd ?? repoRoot(),
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60_000,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? e.message ?? String(err);
    return { stdout, stderr };
  }
}

export async function getRepoStatus(): Promise<{
  root: string;
  branch: string | null;
  status: string;
  dirty: boolean;
}> {
  const root = repoRoot();
  const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = await runGit(["status", "--short"]);
  return {
    root,
    branch: branch.stderr && !branch.stdout ? null : branch.stdout.trim() || null,
    status: status.stdout.trim(),
    dirty: Boolean(status.stdout.trim()),
  };
}

export async function getRepoDiff(params: {
  staged?: boolean;
  path?: string;
  worktreeId?: string;
}): Promise<{ cwd: string; diff: string; truncated: boolean }> {
  let cwd = repoRoot();
  if (params.worktreeId) {
    const rows = await db.select().from(agentWorktrees);
    const match = rows.find((r) => r.id === params.worktreeId);
    if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Worktree not found" });
    if (match.removedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Worktree already removed" });
    cwd = match.path;
  }

  const args = ["diff", "--no-color"];
  if (params.staged) args.push("--cached");
  if (params.path) args.push("--", params.path);
  const { stdout, stderr } = await runGit(args, cwd);
  const raw = stdout || stderr;
  const truncated = raw.length > 200_000;
  return { cwd, diff: truncated ? raw.slice(0, 200_000) : raw, truncated };
}

export async function listActiveWorktrees(organizationId: string) {
  const rows = await db
    .select()
    .from(agentWorktrees)
    .where(isNull(agentWorktrees.removedAt))
    .orderBy(desc(agentWorktrees.createdAt))
    .limit(50);

  const orgTaskRows = await db
    .select({
      id: agentTasks.id,
      title: agentTasks.title,
      status: agentTasks.status,
      worktreeId: agentTasks.worktreeId,
    })
    .from(agentTasks)
    .where(eq(agentTasks.organizationId, organizationId))
    .orderBy(desc(agentTasks.updatedAt))
    .limit(500);

  const byWt = new Map<string, { id: string; title: string; status: string }>();
  for (const t of orgTaskRows) {
    if (!t.worktreeId) continue;
    if (!byWt.has(t.worktreeId)) {
      byWt.set(t.worktreeId, { id: t.id, title: t.title, status: t.status });
    }
  }

  const out = [];
  for (const wt of rows) {
    let exists = false;
    try {
      await fs.access(wt.path);
      exists = true;
    } catch {
      exists = false;
    }
    const task = byWt.get(wt.id) ?? null;
    out.push({
      id: wt.id,
      branchName: wt.branchName,
      path: wt.path,
      agentDepartment: wt.agentDepartment,
      isLocked: wt.isLocked,
      existsOnDisk: exists,
      createdAt: wt.createdAt.toISOString(),
      task,
    });
  }
  return out;
}

/**
 * Allowlisted shell commands only — no arbitrary shell, no redirects.
 * Commands run with cwd = repo root (or worktree path when worktreeId set).
 */
const ALLOWED: Array<{ id: string; label: string; argv: string[] }> = [
  { id: "typecheck", label: "npm run typecheck", argv: ["npm", "run", "typecheck"] },
  { id: "lint", label: "npm run lint", argv: ["npm", "run", "lint"] },
  { id: "test", label: "npm run test", argv: ["npm", "run", "test"] },
  { id: "build", label: "npm run build", argv: ["npm", "run", "build"] },
  { id: "validate", label: "npm run validate", argv: ["npm", "run", "validate"] },
  { id: "git-status", label: "git status", argv: ["git", "status", "--short", "--branch"] },
  { id: "git-diff", label: "git diff", argv: ["git", "diff", "--stat"] },
  { id: "git-log", label: "git log -5", argv: ["git", "log", "-5", "--oneline"] },
  { id: "git-branch", label: "git branch", argv: ["git", "branch", "-vv"] },
];

export function listAllowedCommands() {
  return ALLOWED.map(({ id, label }) => ({ id, label }));
}

export async function runAllowedCommand(params: {
  commandId: string;
  worktreeId?: string;
}): Promise<{
  commandId: string;
  argv: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  const spec = ALLOWED.find((c) => c.id === params.commandId);
  if (!spec) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Command not allowlisted: ${params.commandId}`,
    });
  }

  let cwd = repoRoot();
  if (params.worktreeId) {
    const rows = await db.select().from(agentWorktrees);
    const match = rows.find((r) => r.id === params.worktreeId && !r.removedAt);
    if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Worktree not found" });
    cwd = match.path;
  }

  const [bin, ...args] = spec.argv;
  const { assertSafeCommandLine } = await import("../../_core/sandbox");
  assertSafeCommandLine(spec.argv.join(" "));
  // On Windows, npm is often npm.cmd — execFile needs shell for .cmd
  const useShell = process.platform === "win32" && (bin === "npm" || bin === "npx");
  const started = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(bin!, args, {
      cwd,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5 * 60_000,
      shell: useShell,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    return {
      commandId: spec.id,
      argv: spec.argv,
      cwd,
      exitCode: 0,
      stdout: stdout.toString().slice(0, 200_000),
      stderr: stderr.toString().slice(0, 50_000),
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const e = err as {
      code?: number;
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      message?: string;
    };
    return {
      commandId: spec.id,
      argv: spec.argv,
      cwd,
      exitCode: typeof e.status === "number" ? e.status : typeof e.code === "number" ? e.code : 1,
      stdout: (e.stdout?.toString() ?? "").slice(0, 200_000),
      stderr: (e.stderr?.toString() ?? e.message ?? String(err)).slice(0, 50_000),
      durationMs: Date.now() - started,
    };
  }
}

export async function preparePullRequest(params: {
  worktreeId?: string;
  title: string;
  body?: string;
  open?: boolean;
}): Promise<{
  branch: string | null;
  status: string;
  diffStat: string;
  draftBody: string;
  prUrl: string | null;
  opened: boolean;
  reason?: string;
}> {
  let cwd = repoRoot();
  let branchName: string | null = null;

  if (params.worktreeId) {
    const rows = await db.select().from(agentWorktrees);
    const match = rows.find((r) => r.id === params.worktreeId && !r.removedAt);
    if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Worktree not found" });
    cwd = match.path;
    branchName = match.branchName;
  } else {
    const b = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    branchName = b.stdout.trim() || null;
  }

  const status = await runGit(["status", "--short"], cwd);
  const diffStat = await runGit(["diff", "--stat", "HEAD"], cwd);

  const draftBody =
    params.body?.trim() ||
    [
      "## Summary",
      params.title,
      "",
      "## Status",
      "```",
      status.stdout.trim() || "(clean)",
      "```",
      "",
      "## Diff stat",
      "```",
      diffStat.stdout.trim() || "(no unstaged/uncommitted diff vs HEAD)",
      "```",
      "",
      "_Prepared by WorkerAgent.Cloud IDEa — review before merge._",
    ].join("\n");

  if (!params.open) {
    return {
      branch: branchName,
      status: status.stdout.trim(),
      diffStat: diffStat.stdout.trim(),
      draftBody,
      prUrl: null,
      opened: false,
      reason: "Draft only — pass open:true with GITHUB_TOKEN + GITHUB_REPO to create a PR",
    };
  }

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return {
      branch: branchName,
      status: status.stdout.trim(),
      diffStat: diffStat.stdout.trim(),
      draftBody,
      prUrl: null,
      opened: false,
      reason: "GITHUB_TOKEN / GITHUB_REPO not configured — draft prepared only",
    };
  }

  if (!branchName || branchName === "HEAD" || branchName === "main" || branchName === "master") {
    return {
      branch: branchName,
      status: status.stdout.trim(),
      diffStat: diffStat.stdout.trim(),
      draftBody,
      prUrl: null,
      opened: false,
      reason: "Refusing to open PR from main/master/detached HEAD — use an agent worktree branch",
    };
  }

  try {
    const prUrl = await openPullRequest({
      branchName,
      title: params.title,
      body: draftBody,
    });
    return {
      branch: branchName,
      status: status.stdout.trim(),
      diffStat: diffStat.stdout.trim(),
      draftBody,
      prUrl,
      opened: true,
    };
  } catch (err) {
    return {
      branch: branchName,
      status: status.stdout.trim(),
      diffStat: diffStat.stdout.trim(),
      draftBody,
      prUrl: null,
      opened: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
