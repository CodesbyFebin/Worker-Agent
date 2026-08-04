import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { agentWorktrees } from "../../drizzle/schema";
import type { AgentRole } from "../../shared/types";

const execFileAsync = promisify(execFile);

/**
 * Root of the main repo checkout that `git worktree add` branches off of.
 * Override via env if your repo lives somewhere else in CI/deploy.
 */
const REPO_ROOT = process.env.GOD_MACHINE_REPO_ROOT ?? process.cwd();
const WORKTREE_BASE = process.env.GOD_MACHINE_WORKTREE_DIR ?? path.join(REPO_ROOT, ".worktrees");

let resolvedGit: string | null | undefined;

async function resolveGitBin(): Promise<string | null> {
  if (resolvedGit !== undefined) return resolvedGit;
  const candidates = [
    process.env.GIT_PATH,
    "git",
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\bin\\git.exe",
    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
  ].filter(Boolean) as string[];

  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ["--version"]);
      resolvedGit = bin;
      return bin;
    } catch {
      /* try next */
    }
  }
  resolvedGit = null;
  return null;
}

async function runGit(args: string[]): Promise<string> {
  const git = await resolveGitBin();
  if (!git) throw new Error("git not found on PATH (set GIT_PATH)");
  const { stdout } = await execFileAsync(git, args, { cwd: REPO_ROOT });
  return stdout.trim();
}

/**
 * Creates a new branch + isolated worktree for a single agent task.
 * If git is unavailable, falls back to a plain scratch directory so
 * content agents (researcher/writer/reviewer) still run.
 */
export async function createWorktree(params: {
  agentDepartment: AgentRole;
  taskId: string;
}): Promise<{ id: string; branchName: string; worktreePath: string }> {
  const id = randomUUID();
  const short = `${params.taskId.slice(0, 8)}-${id.slice(0, 6)}`;
  const branchName = `god-machine/${params.agentDepartment}/${short}`;
  const worktreePath = path.join(WORKTREE_BASE, id);

  const git = await resolveGitBin();
  if (git) {
    try {
      await runGit(["worktree", "add", "-b", branchName, worktreePath, "HEAD"]);
    } catch (err) {
      console.warn("[worktree] git worktree add failed, using scratch dir:", (err as Error).message);
      await fs.mkdir(worktreePath, { recursive: true });
    }
  } else {
    console.warn("[worktree] git missing — using scratch directory for", params.agentDepartment);
    await fs.mkdir(worktreePath, { recursive: true });
  }

  await db.insert(agentWorktrees).values({
    id,
    branchName,
    path: worktreePath,
    agentDepartment: params.agentDepartment,
    isLocked: false,
    createdAt: new Date(),
  });

  return { id, branchName, worktreePath };
}

/** Marks a worktree as locked/unlocked so two tasks can't be dispatched into it at once. */
export async function setWorktreeLock(worktreeId: string, locked: boolean): Promise<void> {
  await db.update(agentWorktrees).set({ isLocked: locked }).where(eq(agentWorktrees.id, worktreeId));
}

/**
 * Tears down a worktree once its task is done. Does NOT delete the branch —
 * that's a deliberate choice so completed agent work stays reviewable/mergeable
 * even after the working directory is cleaned up.
 */
export async function removeWorktree(worktreeId: string): Promise<void> {
  const [worktree] = await db
    .select()
    .from(agentWorktrees)
    .where(eq(agentWorktrees.id, worktreeId))
    .limit(1);

  if (!worktree) return;

  try {
    const git = await resolveGitBin();
    if (git) {
      await runGit(["worktree", "remove", worktree.path, "--force"]);
    } else {
      await fs.rm(worktree.path, { recursive: true, force: true });
    }
  } catch {
    await fs.rm(worktree.path, { recursive: true, force: true }).catch(() => undefined);
  }

  await db
    .update(agentWorktrees)
    .set({ removedAt: new Date() })
    .where(eq(agentWorktrees.id, worktreeId));
}

/** Best-effort cleanup of any worktree entries whose directories no longer exist. */
export async function pruneStaleWorktrees(): Promise<void> {
  try {
    await runGit(["worktree", "prune"]);
  } catch {
    /* ignore when git missing */
  }
}
