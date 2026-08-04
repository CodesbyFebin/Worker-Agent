import { describe, expect, it } from "vitest";
import { canonicalJson, hashPayload } from "../services/governance/engine";
import { PERMISSIONS, ROLE_PERMISSION_MAP } from "../_core/auth/permissions";

describe("phase8 payload binding", () => {
  it("hashes stably regardless of key order", () => {
    const a = hashPayload({ b: 1, a: 2 });
    const b = hashPayload({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("detects payload drift", () => {
    expect(hashPayload({ x: 1 })).not.toBe(hashPayload({ x: 2 }));
  });

  it("canonicalizes nested objects", () => {
    expect(canonicalJson({ z: { b: 1, a: 2 }, y: [3, 1] })).toContain('"a":2');
  });
});

describe("phase8 permissions", () => {
  it("includes approval and governance keys", () => {
    expect(PERMISSIONS).toContain("approval:read");
    expect(PERMISSIONS).toContain("approval:decide");
    expect(PERMISSIONS).toContain("governance:write");
    expect(ROLE_PERMISSION_MAP.member).toContain("approval:decide");
    expect(ROLE_PERMISSION_MAP.member).not.toContain("governance:write");
    expect(ROLE_PERMISSION_MAP.viewer).toContain("approval:read");
    expect(ROLE_PERMISSION_MAP.viewer).not.toContain("approval:decide");
  });
});
