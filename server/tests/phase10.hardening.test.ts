import { describe, expect, it } from "vitest";
import { redactString, redactValue, safeJsonStringify } from "../_core/redact";
import { assertSafeCommandLine, assertSafeRelativePath, sandboxInfo } from "../_core/sandbox";
import { _resetRateLimitBuckets, rateLimitMiddleware } from "../_core/rateLimit";
import { getCounters, incCounter, metricsPrometheus, metricsSnapshot } from "../_core/metrics";

describe("secret redaction", () => {
  it("redacts bearer tokens and api keys in strings", () => {
    expect(redactString("Authorization Bearer sk-abc1234567890xyz")).toContain("[REDACTED]");
    expect(redactString("token ghp_abcdefghijklmnopqrstuv")).toContain("[REDACTED]");
  });

  it("redacts secret-shaped object keys", () => {
    const out = redactValue({
      apiKey: "secret-value",
      nested: { password: "x", ok: "visible" },
    }) as Record<string, unknown>;
    expect(out.apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).ok).toBe("visible");
  });

  it("safeJsonStringify never throws on cycles-ish objects", () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
  });
});

describe("sandbox guards", () => {
  it("blocks path traversal and sensitive segments", () => {
    expect(() => assertSafeRelativePath("../etc/passwd")).toThrow(/Sandbox/);
    expect(() => assertSafeRelativePath(".env")).toThrow(/Sandbox/);
    expect(() => assertSafeRelativePath("src/index.ts")).not.toThrow();
  });

  it("blocks dangerous command patterns", () => {
    expect(() => assertSafeCommandLine("rm -rf /")).toThrow(/Sandbox/);
    expect(() => assertSafeCommandLine("npm run typecheck")).not.toThrow();
  });

  it("documents non-VM mode", () => {
    expect(sandboxInfo().mode).toContain("allowlist");
  });
});

describe("rate limit middleware", () => {
  it("returns 429 after max requests in window", () => {
    _resetRateLimitBuckets();
    const mw = rateLimitMiddleware({ windowMs: 60_000, max: 2, keyFn: () => "test-key" });
    const statuses: number[] = [];
    const makeRes = () => {
      const headers: Record<string, string> = {};
      return {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
        status(code: number) {
          statuses.push(code);
          return {
            json: () => undefined,
          };
        },
        json: () => undefined,
      };
    };
    let nextCount = 0;
    const next = () => {
      nextCount += 1;
    };
    mw({} as never, makeRes() as never, next);
    mw({} as never, makeRes() as never, next);
    mw({} as never, makeRes() as never, next);
    expect(nextCount).toBe(2);
    expect(statuses).toContain(429);
  });
});

describe("metrics", () => {
  it("increments counters and renders prometheus text", () => {
    const before = getCounters().http_requests_total ?? 0;
    incCounter("http_requests_total");
    expect(getCounters().http_requests_total).toBe(before + 1);
    const snap = metricsSnapshot();
    expect(snap.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(metricsPrometheus()).toContain("process_uptime_seconds");
  });
});
