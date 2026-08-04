import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/rest";
import { env } from "../../_core/env";

const execFileAsync = promisify(execFile);

function requireGithubConfig(): { owner: string; repo: string; token: string } {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    throw new Error(
      "GitHub integration is not configured — set GITHUB_TOKEN and GITHUB_REPO (owner/repo) to let the Coder Agent commit and open PRs.",
    );
  }
  const [owner, repo] = env.GITHUB_REPO.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPO must be in "owner/repo" format, got "${env.GITHUB_REPO}"`);
  }
  return { owner, repo, token: env.GITHUB_TOKEN };
}

/** Writes a set of files into the given worktree, creating directories as needed. */
export async function writeFiles(
  worktreePath: string,
  files: Array<{ path: string; content: string }>,
): Promise<void> {
  for (const file of files) {
    const absPath = path.join(worktreePath, file.path);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, file.content, "utf-8");
  }
}

/** Stages everything and commits inside the given worktree checkout. */
export async function commitAll(worktreePath: string, message: string): Promise<void> {
  await execFileAsync("git", ["add", "-A"], { cwd: worktreePath });
  await execFileAsync("git", ["commit", "-m", message], { cwd: worktreePath });
}

/** Pushes the worktree's current branch to origin. */
export async function pushBranch(worktreePath: string, branchName: string): Promise<void> {
  const { token } = requireGithubConfig();
  // Inject the token via an authenticated remote URL rather than a global
  // git credential store, so this doesn't leak into the user's global config.
  const { owner, repo } = requireGithubConfig();
  const remote = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await execFileAsync("git", ["push", remote, `HEAD:refs/heads/${branchName}`], { cwd: worktreePath });
}

/** Opens a pull request for the given branch against GITHUB_BASE_BRANCH. Returns the PR URL. */
export async function openPullRequest(params: {
  branchName: string;
  title: string;
  body: string;
}): Promise<string> {
  const { owner, repo, token } = requireGithubConfig();
  const octokit = new Octokit({ auth: token });

  const pr = await octokit.pulls.create({
    owner,
    repo,
    head: params.branchName,
    base: env.GITHUB_BASE_BRANCH,
    title: params.title,
    body: params.body,
  });

  return pr.data.html_url;
}
