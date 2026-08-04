import { describe, expect, it } from "vitest";
import { freshnessScore } from "../services/artifacts/service";
import { storageStatus } from "../services/artifacts/objectStore";
import { PERMISSIONS } from "../_core/auth/permissions";

describe("phase9 freshness", () => {
  it("returns 0 without fetch time", () => {
    expect(freshnessScore(null)).toBe(0);
  });

  it("is near 1 for just-fetched sources", () => {
    expect(freshnessScore(new Date())).toBeGreaterThan(0.95);
  });

  it("decays with age", () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const score = freshnessScore(threeDaysAgo, 72);
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.6);
  });
});

describe("phase9 storage", () => {
  it("reports a configured backend (local or s3)", () => {
    const s = storageStatus();
    expect(["local", "s3"]).toContain(s.backend);
    expect(s.configured).toBe(true);
  });
});

describe("phase9 permissions", () => {
  it("includes artifact permissions", () => {
    expect(PERMISSIONS).toContain("artifact:read");
    expect(PERMISSIONS).toContain("artifact:write");
  });
});
