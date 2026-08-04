/**
 * Lightweight process metrics for /metrics (JSON + Prometheus text).
 */

const startedAt = Date.now();

export type CounterMap = Record<string, number>;

const counters: CounterMap = {
  http_requests_total: 0,
  http_errors_total: 0,
  trpc_errors_total: 0,
  rate_limited_total: 0,
  dlq_enqueued_total: 0,
  dlq_retried_total: 0,
};

export function incCounter(name: keyof typeof counters | string, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function getCounters(): CounterMap {
  return { ...counters };
}

export function metricsSnapshot() {
  const mem = process.memoryUsage();
  return {
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    pid: process.pid,
    node: process.version,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    counters: getCounters(),
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
