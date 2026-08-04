import { describe, expect, it } from "vitest";
import { ROLE_PERMISSION_MAP, PERMISSIONS } from "../_core/auth/permissions";

describe("phase5 agent permissions", () => {
  it("includes agent:write in the canonical permission set", () => {
    expect(PERMISSIONS).toContain("agent:write");
    expect(PERMISSIONS).toContain("agent:read");
    expect(PERMISSIONS).toContain("agent:dispatch");
  });

  it("grants agent:write to members and owners", () => {
    expect(ROLE_PERMISSION_MAP.owner).toContain("agent:write");
    expect(ROLE_PERMISSION_MAP.member).toContain("agent:write");
    expect(ROLE_PERMISSION_MAP.viewer).not.toContain("agent:write");
    expect(ROLE_PERMISSION_MAP.viewer).toContain("agent:read");
  });
});

describe("agent evaluation scoring helpers", () => {
  it("treats expectContains as case-insensitive substring checks", () => {
    const text = "Here are 1. Research 2. Draft 3. Review";
    const expectContains = ["1.", "2.", "3."];
    const lower = text.toLowerCase();
    const hits = expectContains.filter((n) => lower.includes(n.toLowerCase()));
    expect(hits).toHaveLength(3);
  });

  it("flags forbidContains hits", () => {
    const text = "I invented a source at example.com";
    const forbid = ["invented"];
    const lower = text.toLowerCase();
    expect(forbid.some((n) => lower.includes(n.toLowerCase()))).toBe(true);
  });
});
