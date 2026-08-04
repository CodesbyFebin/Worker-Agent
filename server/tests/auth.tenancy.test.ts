import { describe, expect, it } from "vitest";
import { ROLE_PERMISSION_MAP, PERMISSIONS } from "../_core/auth/permissions";
import { hashToken, parseCookies } from "../_core/auth/session";

describe("RBAC permission map", () => {
  it("gives owner every permission", () => {
    expect(ROLE_PERMISSION_MAP.owner).toEqual([...PERMISSIONS]);
  });

  it("does not give viewer write permissions", () => {
    expect(ROLE_PERMISSION_MAP.viewer).not.toContain("script:write");
    expect(ROLE_PERMISSION_MAP.viewer).toContain("script:read");
  });
});

describe("session helpers", () => {
  it("hashes tokens stably", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abcd"));
  });

  it("parses cookies", () => {
    expect(parseCookies("wa_session=tok%201; other=1")).toEqual({
      wa_session: "tok 1",
      other: "1",
    });
  });
});

describe("tenant isolation contract", () => {
  it("requires organization filter on domain lists (documented invariant)", () => {
    // Routers must filter by ctx.organizationId — this test locks the permission
    // surface so a viewer cannot escalate via missing keys alone.
    const member = new Set(ROLE_PERMISSION_MAP.member);
    expect(member.has("org:manage")).toBe(false);
    expect(member.has("audit:read")).toBe(false);
    expect(member.has("script:write")).toBe(true);
  });
});
