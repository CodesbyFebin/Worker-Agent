import { Counter, Gauge, Registry, Summary } from "prom-client";
import { env } from "./env";

const register = new Registry();

const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests by method and status",
  labelNames: ["method", "status", "route"],
  registers: [register],
});

const httpRequestDurationMs = new Summary({
  name: "http_request_duration_ms",
  help: "HTTP request latency in milliseconds",
  labelNames: ["method", "route"],
  percentiles: [0.5, 0.95, 0.99],
  registers: [register],
});

const trpcErrorsTotal = new Counter({
  name: "trpc_errors_total",
  help: "Total tRPC errors by path",
  labelNames: ["path"],
  registers: [register],
});

const rateLimitedTotal = new Counter({
  name: "rate_limited_total",
  help: "Total rate-limited requests",
  labelNames: ["key"],
  registers: [register],
});

const dlqEnqueuedTotal = new Counter({
  name: "dlq_enqueued_total",
  help: "Total jobs moved to dead-letter queue",
  labelNames: ["queue", "job_name"],
  registers: [register],
});

const dlqRetriedTotal = new Counter({
  name: "dlq_retried_total",
  help: "Total DLQ retry attempts",
  labelNames: ["queue"],
  registers: [register],
});

const workflowRunsActive = new Gauge({
  name: "workflow_runs_active",
  help: "Currently active workflow runs by status",
  labelNames: ["status"],
  registers: [register],
});

const agentTasksPending = new Gauge({
  name: "agent_tasks_pending",
  help: "Pending agent tasks by role",
  labelNames: ["role"],
  registers: [register],
});

const pythonBridgeRequestsTotal = new Counter({
  name: "python_bridge_requests_total",
  help: "Total requests to Python FastAPI bridge",
  labelNames: ["endpoint", "status"],
  registers: [register],
});

const pythonBridgeDurationMs = new Summary({
  name: "python_bridge_duration_ms",
  help: "Python bridge request latency in milliseconds",
  labelNames: ["endpoint"],
  percentiles: [0.5, 0.95, 0.99],
  registers: [register],
});

export const metrics = {
  register,
  httpRequestTotal,
  httpRequestDurationMs,
  trpcErrorsTotal,
  rateLimitedTotal,
  dlqEnqueuedTotal,
  dlqRetriedTotal,
  workflowRunsActive,
  agentTasksPending,
  pythonBridgeRequestsTotal,
  pythonBridgeDurationMs,
};

export function metricsText(): string {
  const snap = metricsSnapshot();
  const lines: string[] = [
    `# HELP process_uptime_seconds Process uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${snap.uptimeSec}`,
    `# HELP process_resident_memory_bytes RSS`,
    `# TYPE process_resident_memory_bytes gauge`,
    `process_resident_memory_bytes ${snap.memory.rss}`,
    `# HELP process_heap_used_bytes Heap used`,
    `# TYPE process_heap_used_bytes gauge`,
    `process_heap_used_bytes ${snap.memory.heapUsed}`,
    `# HELP process_heap_total_bytes Heap total`,
    `# TYPE process_heap_total_bytes gauge`,
    `process_heap_total_bytes ${snap.memory.heapTotal}`,
  ];
  for (const [k, v] of Object.entries(snap.counters)) {
    const name = k.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name} ${v}`);
  }
  return lines.join("\n") + "\n";
}

export function metricsJson() {
  return register.getMetricsAsArray();
}

export function metricsSnapshot() {
  const mem = process.memoryUsage();
  return {
    uptimeSec: Math.floor(process.uptime()),
    pid: process.pid,
    node: process.version,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    counters: {
      http_requests_total: Number(process.env.HTTP_REQUESTS_TOTAL ?? 0),
      http_errors_total: Number(process.env.HTTP_ERRORS_TOTAL ?? 0),
      trpc_errors_total: Number(process.env.TRPC_ERRORS_TOTAL ?? 0),
      rate_limited_total: Number(process.env.RATE_LIMITED_TOTAL ?? 0),
      dlq_enqueued_total: Number(process.env.DLQ_ENQUEUED_TOTAL ?? 0),
      dlq_retried_total: Number(process.env.DLQ_RETRIED_TOTAL ?? 0),
    },
    role: process.env.WA_PROCESS_ROLE ?? "api",
    timestamp: new Date().toISOString(),
  };
}

export function metricsPrometheus(): string {
  const snap = metricsSnapshot();
  const lines: string[] = [
    `# HELP process_uptime_seconds Process uptime`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${snap.uptimeSec}`,
    `# HELP process_resident_memory_bytes RSS`,
    `# TYPE process_resident_memory_bytes gauge`,
    `process_resident_memory_bytes ${snap.memory.rss}`,
  ];
  for (const [k, v] of Object.entries(snap.counters)) {
    const name = k.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name} ${v}`);
  }
  return lines.join("\n") + "\n";
}

export function incCounter(name: keyof typeof counters | string, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function getCounters(): Record<string, number> {
  return { ...counters };
}

const counters: Record<string, number> = {
  http_requests_total: 0,
  http_errors_total: 0,
  trpc_errors_total: 0,
  rate_limited_total: 0,
  dlq_enqueued_total: 0,
  dlq_retried_total: 0,
};

