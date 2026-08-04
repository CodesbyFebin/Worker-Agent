import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../routers/_app";
import { createContext } from "./context";
import { env } from "./env";
import { shutdownQueues } from "./queue";
import { subscribeToEvents } from "./events";
import { registerHealthRoutes } from "./health";
import { ensureAuthBootstrap } from "./auth/bootstrap";
import { parseCookies, resolveSession } from "./auth/session";
import { SESSION_COOKIE } from "./auth/permissions";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { organizationMembers } from "../../drizzle/schema";
import { rateLimitMiddleware } from "./rateLimit";
import { redactString } from "./redact";
import { incCounter, metricsPrometheus, metricsSnapshot } from "./metrics";

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
  incCounter("http_requests_total");
  res.on("finish", () => {
    if (res.statusCode >= 400) incCounter("http_errors_total");
  });
  next();
});

registerHealthRoutes(app);

app.get("/metrics", (req, res) => {
  const accept = req.headers.accept ?? "";
  if (accept.includes("text/plain") || req.query.format === "prometheus") {
    res.type("text/plain; version=0.0.4").send(metricsPrometheus());
    return;
  }
  res.json(metricsSnapshot());
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
      incCounter("trpc_errors_total");
      console.error(`[tRPC] ${path ?? "<unknown>"}:`, redactString(error.message));
    },
  }),
);

/**
 * Org-scoped SSE stream. Requires a valid session cookie; events are filtered
 * to the session's active organization (or x-organization-id membership).
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "connected", organizationId })}\n\n`);

  const unsub = subscribeToEvents((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }, organizationId);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsub();
  });
});

async function main() {
  process.env.WA_PROCESS_ROLE = "api";
  await ensureAuthBootstrap();

  const server = app.listen(env.PORT, () => {
    console.log(`Worker Agent.Cloud API listening on :${env.PORT}`);
  });

  async function shutdown(signal: string) {
    console.log(`[api-shutdown] received ${signal}, closing HTTP and queue publishers…`);
    await shutdownQueues();
    server.close(() => process.exit(0));
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
