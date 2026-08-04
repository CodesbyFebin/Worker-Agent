/**
 * Sandbox constraints for agent/IDE execution.
 * Complements allowlisted commands — never claims full isolation.
 */

const BLOCKED_PATH_SEGMENTS = [
  "..",
  "node_modules",
  ".git",
  ".env",
  ".ssh",
  "AppData",
  "System32",
];

const BLOCKED_COMMAND_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/s/i,
  /format\s+/i,
  /mkfs/i,
  /shutdown/i,
  /powershell\s+-enc/i,
  /curl\s+.*\|\s*sh/i,
  /wget\s+.*\|\s*sh/i,
];

export function assertSafeRelativePath(rel: string): void {
  const normalized = rel.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error("Sandbox: absolute paths are not allowed");
  }
  for (const seg of normalized.split("/")) {
    if (BLOCKED_PATH_SEGMENTS.includes(seg) || seg === "..") {
      throw new Error(`Sandbox: path segment blocked (${seg})`);
    }
  }
}

export function assertSafeCommandLine(cmd: string): void {
  for (const re of BLOCKED_COMMAND_PATTERNS) {
    if (re.test(cmd)) {
      throw new Error("Sandbox: command pattern blocked");
    }
  }
}

export function sandboxInfo() {
  return {
    mode: "allowlist+path-guards",
    note: "Not a VM/container sandbox — Git worktrees + allowlisted commands only",
    blockedPathSegments: BLOCKED_PATH_SEGMENTS,
  };
}
