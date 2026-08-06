import pino from "pino";
import { env } from "./env";

export type LogContext = Record<string, unknown>;

const isDevelopment = env.NODE_ENV === "development";

export const logger = pino(
  {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    formatters: {
      log: (log) => {
        if (isDevelopment) return log;
        return {
          ts: new Date(log.ts as number | string | Date).toISOString(),
          lvl: log.level,
          msg: log.msg,
          ...log,
        };
      },
    },
    redact: {
      paths: [
        "authorization",
        "api_key",
        "access_token",
        "refresh_token",
        "password",
        "secret",
        "credential",
        "private_key",
        "cookie",
        "session",
        "x-api-key",
        "*.authorization",
        "*.api_key",
        "*.password",
        "*.secret",
        "*.access_token",
        "*.refresh_token",
        "*.private_key",
        "req.headers.authorization",
        "req.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  },
  isDevelopment ? pino.transport({ target: "./_core/logger-transport.js" }) : undefined,
);

if (!isDevelopment) {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), event: "logger_ready", pid: process.pid }) + "\n",
  );
}

export function childLogger(context: LogContext) {
  return logger.child(context);
}

export function requestLogger(context: LogContext) {
  return logger.child({ ...context, component: "http" });
}

export function queueLogger(context: LogContext) {
  return logger.child({ ...context, component: "queue" });
}

export function pythonBridgeLogger(context: LogContext) {
  return logger.child({ ...context, component: "python_bridge" });
}
