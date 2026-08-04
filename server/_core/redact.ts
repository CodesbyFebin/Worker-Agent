/**
 * Secret redaction for logs, audit payloads, and error surfaces.
 * Never invents success — only strips sensitive substrings.
 */

const SECRET_KEY =
  /^(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|credential|private[_-]?key|cookie|session|x-api-key)$/i;

const SECRET_VALUE =
  /\b(sk-[a-zA-Z0-9_-]{8,}|sk-ant-[a-zA-Z0-9_-]{8,}|sk-or-v1-[a-zA-Z0-9_-]{8,}|nvapi-[a-zA-Z0-9_-]{8,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,}|Bearer\s+[A-Za-z0-9._-]+)/gi;

export function redactString(input: string): string {
  return input.replace(SECRET_VALUE, "[REDACTED]");
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (typeof value === "string") return redactString(value);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(redactValue(value));
  } catch {
    return JSON.stringify({ error: "unserializable" });
  }
}
