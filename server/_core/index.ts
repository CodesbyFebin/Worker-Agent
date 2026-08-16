import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter, appRouterV1 } from "../routers/_app";
import { versionedRestRouter } from "../routers/rest.index";
import { webhookRouter } from "../routers/webhook";
import { createContext } from "./context";
import { env } from "./env";
import { shutdownQueues } from "./queue";
import { registerHealthRoutes } from "./health";
import { registerRobotsRoutes } from "./robots";
import { ensureAuthBootstrap } from "./auth/bootstrap";
import { parseCookies, resolveSession } from "./auth/session";
import { SESSION_COOKIE } from "./auth/permissions";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { organizationMembers } from "../../drizzle/schema";
import { rateLimitMiddleware } from "./rateLimit";
import { redactString } from "./redact";
import { metrics, metricsText } from "./metrics";
import { logger, requestLogger } from "./logger";
import { initTracing, shutdownTracing } from "./tracing";
import { handleMissionControlEvents } from "../services/mission-control/sse";

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: [clientOrigin, "http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const reqLogger = requestLogger({ method: req.method, route: req.path, requestId: req.headers["x-request-id"] });
  reqLogger.info("request_started");
  metrics.httpRequestTotal.inc({ method: req.method, route: req.path, status: "pending" });

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const status = String(res.statusCode);
    metrics.httpRequestTotal.inc({ method: req.method, route: req.path, status });
    metrics.httpRequestDurationMs.observe({ method: req.method, route: req.path }, durationMs);
    if (res.statusCode >= 400) {
      metrics.trpcErrorsTotal.inc({ path: req.path });
      reqLogger.warn({ status, durationMs }, "request_failed");
    } else {
      reqLogger.info({ status, durationMs }, "request_completed");
    }
  });
  next();
});

registerHealthRoutes(app);
registerRobotsRoutes(app);

app.get("/metrics", (req, res) => {
  const accept = req.headers.accept ?? "";
  if (accept.includes("text/plain") || req.query.format === "prometheus") {
    res.type("text/plain; version=0.0.4").send(metricsText());
    return;
  }
  res.json(metrics.register.getMetricsAsArray());
});

const apiLimiter = rateLimitMiddleware({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  keyFn: (req) => {
    const xf = req.headers["x-forwarded-for"];
    const ip =
      typeof xf === "string" ? xf.split(",")[0]!.trim() : req.socket.remoteAddress ?? "unknown";
    return `api:${ip}`;
  },
});

app.use(
  "/trpc",
  apiLimiter,
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      metrics.trpcErrorsTotal.inc({ path: path ?? "unknown" });
      logger.warn({ path, error: redactString(error.message) }, "trpc_error");
    },
  }),
);

app.use("/api/v1", apiLimiter, versionedRestRouter);
app.use("/webhooks", webhookRouter);

/**
 * Org-scoped durable Mission Control SSE stream. Authentication and tenant
 * membership are resolved here; the stream handler receives only the verified
 * active organization id.
 */
app.get("/events", apiLimiter, async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Sign in required" });
    return;
  }
  const session = await resolveSession(token);
  if (!session) {
    res.status(401).json({ error: "UNAUTHENTICATED", message: "Invalid or expired session" });
    return;
  }

  let organizationId = session.organizationId;
  const headerOrg = req.headers["x-organization-id"];
  if (typeof headerOrg === "string" && headerOrg.trim()) {
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.userId),
          eq(organizationMembers.organizationId, headerOrg.trim()),
        ),
      )
      .limit(1);
    if (membership) organizationId = membership.organizationId;
  }

  await handleMissionControlEvents(req, res, organizationId);
});

async function main() {
  process.env.WA_PROCESS_ROLE = "api";
  await ensureAuthBootstrap();

  if (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || env.NODE_ENV === "development") {
    try {
      initTracing();
      logger.info("OpenTelemetry tracing initialized");
    } catch (err) {
      logger.warn({ error: redactString(err instanceof Error ? err.message : String(err)) }, "tracing_init_failed");
    }
  }

  try {
    const { pluginRegistry } = await import("../services/plugins/registry");
    const { default: builtinDummyAi } = await import("../services/plugins/builtins");
    logger.info({ plugins: pluginRegistry.list().map((p) => p.manifest.id) }, "plugins_loaded");
  } catch (err) {
    logger.warn({ error: redactString(err instanceof Error ? err.message : String(err)) }, "plugin_init_failed");
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, role: "api" }, "api_started");
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, "api_shutdown_started");
    await shutdownQueues();
    await shutdownTracing().catch(() => {});
    server.close(() => process.exit(0));
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
