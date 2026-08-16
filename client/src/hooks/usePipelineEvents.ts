import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/trpc";

export type PipelineEventType =
  | "status_changed"
  | "retry"
  | "error"
  | "info"
  | "pipeline_handoff"
  | "pipeline_advance";

export type PipelineEvent = {
  taskId: string;
  organizationId: string | null;
  eventType: PipelineEventType;
  message: string;
};

export type PipelineEventConnection = "connecting" | "connected" | "reconnecting";

function eventsUrl(): string {
  const url = new URL(API_URL, window.location.origin);
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/trpc") ? `${path.slice(0, -5)}/events` : `${path}/events`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isPipelineEvent(value: unknown): value is PipelineEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<PipelineEvent>;
  if ("type" in event && event.type === "research") return false;
  const validTypes: PipelineEventType[] = [
    "status_changed",
    "retry",
    "error",
    "info",
    "pipeline_handoff",
    "pipeline_advance",
  ];
  return (
    typeof event.eventType === "string" &&
    validTypes.includes(event.eventType as PipelineEventType) &&
    typeof event.message === "string"
  );
}

export function usePipelineEvents() {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [connection, setConnection] = useState<PipelineEventConnection>("connecting");

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
        if (!isPipelineEvent(payload)) return;
        setEvents((current) => [...current.slice(-99), payload]);
      } catch {
        // Heartbeats and malformed payloads are silently ignored.
      }
    };
    source.onerror = () => setConnection("reconnecting");

    return () => source.close();
  }, []);

  return { events, connection, clear: () => setEvents([]) };
}
