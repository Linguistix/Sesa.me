/**
 * Fixed-window rate limiter.
 *
 * The in-memory implementation is correct for a single process and is what
 * runs in development and small deployments. It is intentionally behind an
 * interface: on a multi-instance deployment each process would keep its own
 * counters and the effective limit would multiply by the instance count, so
 * production should swap in the Redis store (see `createRedisRateLimiter`
 * below) where the counter is shared.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** When the current window resets, as epoch milliseconds. */
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

export interface RateLimitOptions {
  /** Maximum requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export function createMemoryRateLimiter({ limit, windowMs }: RateLimitOptions): RateLimiter {
  const windows = new Map<string, Window>();

  return {
    async check(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        windows.set(key, { count: 1, resetAt });
        // Opportunistic sweep so an unbounded key space (one entry per IP)
        // cannot grow forever in a long-lived process.
        if (windows.size > 10_000) sweep(windows, now);
        return { ok: true, remaining: limit - 1, resetAt };
      }

      existing.count += 1;
      return {
        ok: existing.count <= limit,
        remaining: Math.max(0, limit - existing.count),
        resetAt: existing.resetAt,
      };
    },
  };
}

function sweep(windows: Map<string, Window>, now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Redis-backed limiter for multi-instance deployments.
 *
 * Takes a minimal client interface rather than a concrete Redis package so the
 * caller chooses the driver (ioredis, node-redis, Upstash REST). INCR plus a
 * PEXPIRE on first write is the standard fixed-window primitive and is atomic
 * enough here: a lost expiry would only shorten one window.
 */
export interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
}

export function createRedisRateLimiter(
  redis: RedisLike,
  { limit, windowMs }: RateLimitOptions,
): RateLimiter {
  return {
    async check(key: string): Promise<RateLimitResult> {
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);

      const ttl = await redis.pttl(key);
      const resetAt = Date.now() + (ttl > 0 ? ttl : windowMs);

      return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt };
    },
  };
}

/**
 * The app's limiters.
 *
 * Analytics is generous — a real visitor clicking around a page produces
 * several events a minute and must never be throttled — while AI generation
 * (phase 3) is tight because each call costs money.
 */
export const analyticsLimiter = createMemoryRateLimiter({ limit: 120, windowMs: 60_000 });
export const unlockLimiter = createMemoryRateLimiter({ limit: 10, windowMs: 60_000 });
