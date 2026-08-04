import type { Express, Request, Response } from "express";
import { pingDatabase } from "./db";
import { pingRedis } from "./queue";
import { env } from "./env";

export type ReadyCheck = {
  ok: boolean;
  database: "up" | "down";
  redis: "up" | "down";
  errors: string[];
};

/**
 * Liveness: process is up. Does not verify dependencies.
 */
export function registerHealthRoutes(app: Express): void {
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "api",
      status: "alive",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    const result = await checkReadiness();
    res.status(result.ok ? 200 : 503).json({
      ...result,
      service: "api",
      status: result.ok ? "ready" : "not_ready",
      redisUrlHost: safeRedisHost(env.REDIS_URL),
      timestamp: new Date().toISOString(),
    });
  });
}

export async function checkReadiness(): Promise<ReadyCheck> {
  const errors: string[] = [];
  let database: "up" | "down" = "down";
  let redis: "up" | "down" = "down";

  try {
    await pingDatabase();
    database = "up";
  } catch (err) {
    errors.push(`database: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await pingRedis();
    redis = "up";
  } catch (err) {
    errors.push(`redis: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    ok: database === "up" && redis === "up",
    database,
    redis,
    errors,
  };
}

function safeRedisHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "6379"}`;
  } catch {
    return "invalid-url";
  }
}
