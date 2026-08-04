import { describe, expect, it } from "vitest";
import { listAllowedCommands } from "../services/ide/gitOps";
import { repoRoot } from "../services/ide/repoFs";

describe("ide allowlisted commands", () => {
  it("exposes gate commands used by the terminal panel", () => {
    const ids = listAllowedCommands().map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(["typecheck", "lint", "test", "build", "git-status", "git-diff"]),
    );
  });

  it("does not allow arbitrary shell ids", () => {
    const ids = listAllowedCommands().map((c) => c.id);
    expect(ids).not.toContain("rm");
    expect(ids).not.toContain("bash");
  });
});

describe("ide repo root", () => {
  it("resolves a filesystem path", () => {
    const root = repoRoot();
    expect(root.length).toBeGreaterThan(1);
  });
});
