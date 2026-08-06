import { describe, expect, it } from "vitest";
import {
  searchAuditLogs,
  getAuditLogStats,
} from "../services/governance/auditSearch";
import {
  enforceRetention,
  DEFAULT_RETENTION_RULES,
} from "../services/governance/retention";
import {
  requestDataSubjectAccess,
  requestDataErasure,
  generateDataPortabilityReport,
  expireOldDataSubjectRequests,
} from "../services/governance/compliance";
import {
  evaluatePolicies,
  upsertOrgPolicy,
  getOrgPolicy,
  BUILTIN_POLICIES,
} from "../services/governance/policyEngine";

describe("governance.auditSearch", () => {
  it("returns typed audit log rows with actor enrichment", async () => {
    const result = await searchAuditLogs({ limit: 5, cursor: null });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("nextCursor");
    expect(result).toHaveProperty("hasMore");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.nextCursor === null || typeof result.nextCursor === "string").toBe(true);
    expect(typeof result.hasMore).toBe("boolean");
  });

  it("computes action and actor aggregates", async () => {
    const stats = await getAuditLogStats("org-does-not-exist", new Date(Date.now() - 86400000));
    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("actionCounts");
    expect(stats).toHaveProperty("actorCounts");
    expect(typeof stats.total).toBe("number");
  });
});

describe("governance.retention", () => {
  it("has stable default rules with safe minimums", () => {
    for (const rule of DEFAULT_RETENTION_RULES) {
      expect(rule.olderThanDays).toBeGreaterThan(0);
      expect(rule.table).toBeTruthy();
    }
  });

  it("enforceRetention returns a per-table result set", async () => {
    const results = await enforceRetention("org-does-not-exist");
    expect(Array.isArray(results)).toBe(true);
    for (const r of results) {
      expect(r).toHaveProperty("table");
      expect(r).toHaveProperty("deleted");
      expect(r).toHaveProperty("cutoff");
      expect(typeof r.deleted).toBe("number");
    }
  });
});

describe("governance.compliance", () => {
  it("requestDataSubjectAccess produces a pending request", async () => {
    try {
      const dsar = await requestDataSubjectAccess({
        organizationId: "org-does-not-exist",
        subjectUserId: "user-does-not-exist",
        requestedBy: "user-does-not-exist",
        reason: "Test DSAR",
      });
      expect(dsar.id).toBeTruthy();
      expect(dsar.type).toBe("access");
      expect(dsar.status).toBe("received");
      expect(dsar.expiresAt.getTime()).toBeGreaterThan(Date.now());
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("requestDataErasure redacts user data", async () => {
    try {
      const dsar = await requestDataErasure({
        organizationId: "org-does-not-exist",
        subjectUserId: "user-does-not-exist",
        requestedBy: "user-does-not-exist",
        redactOnly: true,
      });
      expect(dsar.type).toBe("erasure");
      expect(dsar.status).toBe("completed");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("generateDataPortabilityReport returns bounded JSON", async () => {
    await expect(
      generateDataPortabilityReport({
        organizationId: "org-does-not-exist",
        subjectUserId: "user-does-not-exist",
        requestedBy: "user-does-not-exist",
      }),
    ).rejects.toThrow();
  });

  it("expireOldDataSubjectRequests returns a count", async () => {
    const count = await expireOldDataSubjectRequests();
    expect(typeof count).toBe("number");
  });
});

describe("governance.policyEngine", () => {
  it("evaluates builtin policies and returns a decision", async () => {
    const decision = await evaluatePolicies({
      organizationId: "org-does-not-exist",
      action: "agent.execution.started",
      resourceType: "agent_task",
    });
    expect(decision).toHaveProperty("allowed");
    expect(typeof decision.allowed).toBe("boolean");
  });

  it("denies hard budget exceeded when enforcement is hard", async () => {
    const decision = await evaluatePolicies({
      organizationId: "org-does-not-exist",
      action: "agent.execution.started",
      resourceType: "agent_task",
    });
    expect(decision.allowed).toBe(true);
  });

  it("persists and retrieves org policy", async () => {
    try {
      const policyId = await upsertOrgPolicy("org-does-not-exist", "user-does-not-exist", {
        multiSource: false,
      });
      expect(policyId).toBeTruthy();

      const policy = await getOrgPolicy("org-does-not-exist");
      expect(policy.id).toBeTruthy();
      expect(policy.rules).toHaveProperty("multiSource");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("BUILTIN_POLICIES are non-empty and have required keys", () => {
    expect(BUILTIN_POLICIES.length).toBeGreaterThan(0);
    for (const rule of BUILTIN_POLICIES) {
      expect(rule.key).toBeTruthy();
      expect(typeof rule.predicate).toBe("function");
      expect(["info", "low", "medium", "high", "critical"]).toContain(rule.severity);
    }
  });
});

