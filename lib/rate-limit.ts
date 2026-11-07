/**
 * In-process fixed-window rate limiter.
 *
 * First layer only: state is per Node process, so with more than one pm2
 * instance each instance counts separately. Back it with nginx
 * `limit_req` or a shared store before relying on it as the only control.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs, maxKeys = 10_000, now = Date.now } = opts;
  const windows = new Map<string, { start: number; count: number }>();

  return {
    check(key) {
      const t = now();
      let w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        if (!w && windows.size >= maxKeys) {
          // Evict the oldest entry; Map iterates in insertion order.
          const oldest = windows.keys().next().value;
          if (oldest !== undefined) windows.delete(oldest);
        }
        w = { start: t, count: 0 };
        windows.delete(key);
        windows.set(key, w);
      }
      w.count += 1;
      const allowed = w.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - w.count),
        retryAfterSeconds: allowed ? 0 : Math.ceil((w.start + windowMs - t) / 1000),
      };
    },
  };
}
