import { execFile } from "child_process";
import { promisify } from "util";
import type { AgentExecutionContext } from "./base";

const execFileAsync = promisify(execFile);

interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
}

interface QAReport {
  passed: boolean;
  checks: CheckResult[];
}

/**
 * Runs each command in the worktree if a script for it exists in package.json;
 * skips (not fails) checks that aren't configured, so this doesn't force
 * every repo to have lint/typecheck/test scripts to use the QA agent.
 */
async function runCheck(worktreePath: string, name: string, npmScript: string): Promise<CheckResult> {
  try {
    const pkgRaw = await execFileAsync("cat", ["package.json"], { cwd: worktreePath }).catch(() => null);
    const hasScript = pkgRaw?.stdout?.includes(`"${npmScript}"`);
    if (!hasScript) {
      return { name, passed: true, output: `skipped — no "${npmScript}" script in package.json` };
    }

    const { stdout, stderr } = await execFileAsync("npm", ["run", npmScript, "--silent"], {
      cwd: worktreePath,
      timeout: 5 * 60 * 1000,
    });
    return { name, passed: true, output: (stdout + stderr).slice(-4000) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return { name, passed: false, output: (e.stdout ?? "") + (e.stderr ?? "") || e.message };
  }
}

export async function executeQATask(ctx: AgentExecutionContext): Promise<QAReport> {
  const checks = await Promise.all([
    runCheck(ctx.worktreePath, "lint", "lint"),
    runCheck(ctx.worktreePath, "typecheck", "typecheck"),
    runCheck(ctx.worktreePath, "test", "test"),
  ]);

  const passed = checks.every((c) => c.passed);
  if (!passed) {
    const failing = checks.filter((c) => !c.passed).map((c) => c.name).join(", ");
    throw new Error(`QA failed: ${failing}`);
  }

  return { passed, checks };
}
