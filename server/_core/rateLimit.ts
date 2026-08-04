import type { Request, Response, NextFunction } from "express";
import { incCounter } from "./metrics";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
};

/**
 * Simple in-process sliding fixed-window limiter.
 * Suitable for single-node API; multi-replica should use Redis later.
 */
export function rateLimitMiddleware(opts: RateLimitOptions) {
  const keyFn =
    opts.keyFn ??
    ((req: Request) => {
      const xf = req.headers["x-forwarded-for"];
      const ip =
        typeof xf === "string"
          ? xf.split(",")[0]!.trim()
          : req.socket.remoteAddress ?? "unknown";
      return `${ip}:${req.path}`;
    });

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > opts.max) {
      incCounter("rate_limited_total");
      res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many requests — slow down and retry",
        retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
      });
      return;
    }
    next();
  };
}

/** Test helper */
export function _resetRateLimitBuckets(): void {
  buckets.clear();
}
