import { Router as ExpressRouter } from "express";
import type { NextFunction, Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../_core/db";
import { orchestrateGoal } from "../_core/god-machine";
import { listChannels } from "../services/youtube/studio";
import { metricsSnapshot } from "../_core/metrics";
import { requirePermission } from "../_core/restAuth";
import type { AuthContext } from "../_core/context";
import { searchKnowledge, searchSimilar, upsertEmbedding } from "../services/knowledge";
import type { SearchIndexEntity } from "../services/knowledge/search";
import { contentCampaigns, workflowDefinitions } from "../../drizzle/schema";

export const v1Router = ExpressRouter();

function requireOrg(req: Request): { ctx: AuthContext; orgId: string } {
  const ctx = req.auth;
  if (!ctx) throw new Error("restAuth middleware not installed");
  if (!ctx.organizationId) throw new Error("No active organization");
  return { ctx, orgId: ctx.organizationId };
}

v1Router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ...metricsSnapshot() });
});

v1Router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(buildOpenApiDocument());
});

v1Router.get("/workflows", requirePermission("workflow:read"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = requireOrg(req);
    const rows = await db.select().from(workflowDefinitions).where(eq(workflowDefinitions.organizationId, orgId)).orderBy(desc(workflowDefinitions.updatedAt));
    res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch (err) {
    next(err);
  }
});

v1Router.post("/goals", requirePermission("agent:dispatch"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ctx, orgId } = requireOrg(req);
    const { goal, scriptId } = (req.body ?? {}) as { goal?: unknown; scriptId?: unknown };
    if (typeof goal !== "string" || goal.length < 1 || goal.length > 2000) {
      res.status(400).json({ error: "BAD_REQUEST", message: "goal is required (1–2000 chars)" });
      return;
    }
    const result = await orchestrateGoal({ goal, scriptId: typeof scriptId === "string" && scriptId.length > 0 ? scriptId : undefined, userId: ctx.userId ?? undefined, organizationId: orgId });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

v1Router.get("/campaigns", requirePermission("campaign:read"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = requireOrg(req);
    const rows = await db.select().from(contentCampaigns).where(eq(contentCampaigns.organizationId, orgId)).orderBy(desc(contentCampaigns.createdAt));
    res.json(rows.map((c) => ({ ...c, startDate: c.startDate.toISOString(), createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    next(err);
  }
});

v1Router.get("/youtube/channels", requirePermission("youtube:read"), async (req, res, next) => {
  try {
    const { orgId } = requireOrg(req);
    const channels = await listChannels(orgId);
    res.json(channels);
  } catch (err) {
    next(err);
  }
});

v1Router.get("/knowledge/search", requirePermission("knowledge:read"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = requireOrg(req);
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    if (!query || query.length < 1 || query.length > 1000) {
      res.status(400).json({ error: "BAD_REQUEST", message: "query is required (1–1000 chars)" });
      return;
    }
    const entityTypes = req.query.entityTypes ? String(req.query.entityTypes).split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const limit = Number(req.query.limit ?? 25);
    const results = await searchKnowledge({ organizationId: orgId, query, entityTypes: entityTypes as SearchIndexEntity[] | undefined, limit });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

v1Router.get("/knowledge/semantic", requirePermission("knowledge:read"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = requireOrg(req);
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    if (!query || query.length < 1 || query.length > 1000) {
      res.status(400).json({ error: "BAD_REQUEST", message: "query is required (1–1000 chars)" });
      return;
    }
    const entityTypes = req.query.entityTypes ? String(req.query.entityTypes).split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const limit = Number(req.query.limit ?? 25);
    const results = await searchSimilar({ organizationId: orgId, queryText: query, entityTypes, limit });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

v1Router.post("/knowledge/embeddings", requirePermission("knowledge:write"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = requireOrg(req);
    const { entityType, entityId, text, metadata } = (req.body ?? {}) as { entityType?: string; entityId?: string; text?: string; metadata?: Record<string, unknown> };
    if (typeof entityType !== "string" || entityType.length < 1) {
      res.status(400).json({ error: "BAD_REQUEST", message: "entityType is required" });
      return;
    }
    if (typeof entityId !== "string" || entityId.length < 1) {
      res.status(400).json({ error: "BAD_REQUEST", message: "entityId is required" });
      return;
    }
    if (typeof text !== "string" || text.length < 1 || text.length > 25000) {
      res.status(400).json({ error: "BAD_REQUEST", message: "text is required (1–25000 chars)" });
      return;
    }
    const record = await upsertEmbedding({ organizationId: orgId, entityType, entityId, text, metadata });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: { title: "ContentOS API", version: "1.0.0" },
    paths: {
      "/health": { get: { summary: "Health check", responses: { 200: { description: "OK" } } } },
      "/workflows": { get: { summary: "List workflows", responses: { 200: { description: "OK" } } } },
      "/goals": { post: { summary: "Dispatch goal", responses: { 201: { description: "Created" } } } },
      "/campaigns": { get: { summary: "List campaigns", responses: { 200: { description: "OK" } } } },
      "/youtube/channels": { get: { summary: "List YouTube channels", responses: { 200: { description: "OK" } } } },
      "/knowledge/search": { get: { summary: "Search knowledge", responses: { 200: { description: "OK" } } } },
      "/knowledge/semantic": { get: { summary: "Semantic search", responses: { 200: { description: "OK" } } } },
      "/knowledge/embeddings": { post: { summary: "Upsert embedding", responses: { 201: { description: "Created" } } } },
    },
  };
}
