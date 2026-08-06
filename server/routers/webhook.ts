import { Router as ExpressRouter } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../_core/db";
import { webhooks } from "../../drizzle/schema";
import { logger } from "../_core/logger";

const router = ExpressRouter();

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

router.post("/events/:eventType", async (req, res) => {
  const eventType = req.params.eventType;
  const secret = req.headers["x-webhook-secret"];
  if (typeof secret !== "string") {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing x-webhook-secret" });
    return;
  }

  const [sub] = await db.select().from(webhooks).where(and(eq(webhooks.eventType, eventType), eq(webhooks.secretHash, signPayload(secret, "")))).limit(1);
  if (!sub) {
    res.status(404).json({ error: "NOT_FOUND", message: "No webhook subscription for this event" });
    return;
  }

  const payload = JSON.stringify(req.body ?? {});
  const signature = req.headers["x-webhook-signature"];
  if (typeof signature !== "string" || !timingSafeEqual(Buffer.from(signature), Buffer.from(signPayload(secret, payload)))) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid signature" });
    return;
  }

  logger.info({ webhookId: sub.id, eventType }, "webhook_received");
  res.status(202).json({ accepted: true });
});

router.get("/subscriptions", async (req, res) => {
  const subs = await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
  res.json(subs.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
});

export { router as webhookRouter };
