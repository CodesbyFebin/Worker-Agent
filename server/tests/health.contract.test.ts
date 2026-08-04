import { describe, expect, it } from "vitest";

/**
 * Pure readiness shaping — mirrors /ready response contract without needing
 * live DB/Redis in unit tests. Integration coverage belongs in Phase 2+.
 */
function shapeReady(database: "up" | "down", redis: "up" | "down") {
  const errors: string[] = [];
  if (database === "down") errors.push("database: unavailable");
  if (redis === "down") errors.push("redis: unavailable");
  return {
    ok: database === "up" && redis === "up",
    database,
    redis,
    errors,
    status: database === "up" && redis === "up" ? "ready" : "not_ready",
  };
}

describe("readiness contract", () => {
  it("is ready only when both dependencies are up", () => {
    expect(shapeReady("up", "up")).toMatchObject({ ok: true, status: "ready" });
    expect(shapeReady("down", "up").ok).toBe(false);
    expect(shapeReady("up", "down").ok).toBe(false);
    expect(shapeReady("down", "down").errors).toHaveLength(2);
  });
});
