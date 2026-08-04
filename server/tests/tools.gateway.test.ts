import { describe, expect, it } from "vitest";
import { listBuiltinToolSpecs } from "../services/tools/builtins";
import { PERMISSIONS, ROLE_PERMISSION_MAP } from "../_core/auth/permissions";

describe("phase7 tool gateway", () => {
  it("registers builtin tools with stable names", () => {
    const names = listBuiltinToolSpecs().map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "connectors.status",
        "search.web",
        "repo.status",
        "ide.run_command",
        "env.presence",
      ]),
    );
  });

  it("adds tool/mcp permissions to the canonical set", () => {
    expect(PERMISSIONS).toContain("tool:invoke");
    expect(PERMISSIONS).toContain("tool:manage");
    expect(PERMISSIONS).toContain("mcp:manage");
    expect(ROLE_PERMISSION_MAP.member).toContain("tool:invoke");
    expect(ROLE_PERMISSION_MAP.member).not.toContain("mcp:manage");
    expect(ROLE_PERMISSION_MAP.owner).toContain("mcp:manage");
  });

  it("does not invent search results when no query", async () => {
    const { executeBuiltinTool } = await import("../services/tools/builtins");
    await expect(
      executeBuiltinTool("search.web", {}, { organizationId: "x", actorUserId: "y" }),
    ).rejects.toThrow(/query/i);
  });
});
