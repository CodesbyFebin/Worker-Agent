import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/trpc";

export type ResearchStreamPhase = "started" | "completed" | "failed";

export type ResearchStreamEvent = {
  type: "research";
  organizationId: string;
  runId: string;
  phase: ResearchStreamPhase;
  message: string;
  provider?: string;
  model?: string;
  attempts?: number;
};

export type ResearchStreamConnection = "connecting" | "connected" | "reconnecting";

function eventsUrl(): string {
  const url = new URL(API_URL, window.location.origin);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/trpc") ? `${path.slice(0, -5)}/events` : `${path}/events`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isResearchStreamEvent(value: unknown): value is ResearchStreamEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<ResearchStreamEvent>;
  return (
    event.type === "research" &&
    typeof event.organizationId === "string" &&
    typeof event.runId === "string" &&
    (event.phase === "started" || event.phase === "completed" || event.phase === "failed") &&
    typeof event.message === "string"
  );
}

/**
 * Subscribes to the existing authenticated `/events` SSE endpoint.
 * EventSource is intentionally configured with credentials because production
 * can run the Vite client and API on separate origins.
 */
export function useResearchEvents() {
  const [events, setEvents] = useState<ResearchStreamEvent[]>([]);
  const [connection, setConnection] = useState<ResearchStreamConnection>("connecting");

  useEffect(() => {
    const source = new EventSource(eventsUrl(), { withCredentials: true });

    source.onopen = () => setConnection("connected");
    source.onmessage = (message) => {
      try {
        const payload: unknown = JSON.parse(message.data);
        if (
          payload &&
          typeof payload === "object" &&
          "type" in payload &&
          (payload as { type?: unknown }).type === "connected"
        ) {
          setConnection("connected");
          return;
        }
        if (!isResearchStreamEvent(payload)) return;
        setEvents((current) => [...current.slice(-49), payload]);
      } catch {
        // Ignore malformed or non-JSON SSE payloads; heartbeats are comments and
        // never reach this handler.
      }
    };
    source.onerror = () => setConnection("reconnecting");

    return () => source.close();
  }, []);

  return {
    events,
    connection,
    clear: () => setEvents([]),
  };
}
