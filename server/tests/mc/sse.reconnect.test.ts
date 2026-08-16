import { randomUUID } from "node:crypto";
import http from "node:http";
import express from "express";
import IORedis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../_core/db";
import { env } from "../../_core/env";
import { handleMissionControlEvents } from "../../services/mission-control/sse";

const integrationEnabled = process.env.MC_INTEGRATION_TESTS === "1";
const integrationSuite = integrationEnabled ? describe : describe.skip;
const orgA = randomUUID();
const orgB = randomUUID();

function startTestServer(organizationId: string) {
  const app = express();
  app.get("/events", (req, res) => void handleMissionControlEvents(req, res, organizationId));
  const server = http.createServer(app);
  return new Promise<{ server: http.Server; baseUrl: string }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test server address");
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function closeServer(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function readEventIds(
  response: Response,
  count: number,
  timeoutMs = 5000,
): Promise<number[]> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("SSE response has no body");
  const decoder = new TextDecoder();
  let buffer = "";
  const ids: number[] = [];
  const deadline = Date.now() + timeoutMs;

  while (ids.length < count && Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("SSE read timeout")), remaining)),
    ]);
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const idLine = block.split("\n").find((line) => line.startsWith("id: "));
      if (idLine) ids.push(Number(idLine.slice(4)));
    }
  }
  await reader.cancel().catch(() => {});
  return ids;
}

async function appendAndPublish(publisher: IORedis, organizationId: string, ordinal: number) {
  const eventId = `evt_${randomUUID()}`;
  const aggregateId = `task_${ordinal}_${randomUUID()}`;
  const traceId = `trace_${ordinal}`;
  const [result] = await pool.query(
    `INSERT INTO mission_control_event_log
      (event_id, organization_id, aggregate_type, aggregate_id,
       aggregate_version, event_type, trace_id, payload)
     VALUES (?, ?, 'task', ?, 1, 'task.updated', ?, ?)`,
    [eventId, organizationId, aggregateId, traceId, JSON.stringify({ ordinal })],
  );
  const streamPosition = Number((result as any).insertId);
  await publisher.publish(
    `mc:events:${organizationId}`,
    JSON.stringify({
      streamPosition,
      eventId,
      organizationId,
      aggregateType: "task",
      aggregateId,
      aggregateVersion: 1,
      type: "task.updated",
      traceId,
      payload: { ordinal },
    }),
  );
  return streamPosition;
}

describe("Mission Control SSE cursor validation", () => {
  it("rejects unsafe or malformed cursors with 400 before opening Redis", async () => {
    const { server, baseUrl } = await startTestServer("org_cursor_test");
    try {
      for (const bad of ["-1", "1.5", "abc", "9007199254740993"]) {
        const response = await fetch(`${baseUrl}/events?after=${encodeURIComponent(bad)}`);
        expect(response.status).toBe(400);
      }
    } finally {
      await closeServer(server);
    }
  });
});

integrationSuite("Mission Control durable SSE", () => {
  let publisher: IORedis;

  beforeAll(async () => {
    publisher = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    await pool.query("INSERT INTO organizations (id, name, slug) VALUES (?, 'MC SSE A', ?), (?, 'MC SSE B', ?)", [
      orgA,
      `mc-sse-a-${orgA}`,
      orgB,
      `mc-sse-b-${orgB}`,
    ]);
  });

  afterAll(async () => {
    if (!integrationEnabled) return;
    await pool.query("DELETE FROM mission_control_event_log WHERE organization_id IN (?, ?)", [orgA, orgB]);
    await pool.query("DELETE FROM organizations WHERE id IN (?, ?)", [orgA, orgB]);
    await publisher.quit();
  });

  it("replays without loss or duplicate across reconnect while events arrive during handoff", async () => {
    const firstExpected: number[] = [];
    for (let i = 1; i <= 5; i += 1) firstExpected.push(await appendAndPublish(publisher, orgA, i));

    const firstServer = await startTestServer(orgA);
    const firstController = new AbortController();
    try {
      const firstResponse = await fetch(`${firstServer.baseUrl}/events?after=0`, {
        signal: firstController.signal,
        headers: { accept: "text/event-stream" },
      });
      expect(firstResponse.status).toBe(200);
      const firstSeen = await readEventIds(firstResponse, 5);
      expect(firstSeen).toEqual(firstExpected);
      firstController.abort();

      const cursor = firstSeen.at(-1)!;
      const secondServer = await startTestServer(orgA);
      const secondController = new AbortController();
      try {
        const secondResponsePromise = fetch(`${secondServer.baseUrl}/events?after=${cursor}`, {
          signal: secondController.signal,
          headers: { accept: "text/event-stream" },
        });
        const secondResponse = await secondResponsePromise;
        expect(secondResponse.status).toBe(200);

        const secondExpected: number[] = [];
        for (let i = 6; i <= 25; i += 1) {
          secondExpected.push(await appendAndPublish(publisher, orgA, i));
        }
        const secondSeen = await readEventIds(secondResponse, 20, 10_000);
        expect(secondSeen).toEqual(secondExpected);
        expect(new Set([...firstSeen, ...secondSeen]).size).toBe(25);
      } finally {
        secondController.abort();
        await closeServer(secondServer);
      }
    } finally {
      firstController.abort();
      await closeServer(firstServer);
    }
  }, 20_000);

  it("emits a heartbeat on an idle connection", async () => {
    const { server, baseUrl } = await startTestServer(orgA);
    const controller = new AbortController();
    try {
      const response = await fetch(`${baseUrl}/events`, {
        signal: controller.signal,
        headers: { accept: "text/event-stream" },
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      const deadline = Date.now() + 16_500;
      while (!text.includes(": heartbeat") && Date.now() < deadline) {
        const result = await reader.read();
        if (result.done) break;
        text += decoder.decode(result.value, { stream: true });
      }
      expect(text).toContain(": heartbeat");
      await reader.cancel();
    } finally {
      controller.abort();
      await closeServer(server);
    }
  }, 18_000);

  it("organization A stream never receives organization B live events", async () => {
    const { server, baseUrl } = await startTestServer(orgA);
    const controller = new AbortController();
    try {
      const response = await fetch(`${baseUrl}/events`, {
        signal: controller.signal,
        headers: { accept: "text/event-stream" },
      });
      await appendAndPublish(publisher, orgB, 999);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      const read = reader.read().then((result) => {
        if (!result.done) text += decoder.decode(result.value, { stream: true });
      });
      await Promise.race([read, new Promise((resolve) => setTimeout(resolve, 1500))]);
      expect(text).not.toContain('"organizationId":"' + orgB + '"');
      await reader.cancel().catch(() => {});
    } finally {
      controller.abort();
      await closeServer(server);
    }
  }, 5000);
});
