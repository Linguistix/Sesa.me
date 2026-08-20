import { getRedis, noteRedisFailure, noteRedisSuccess } from "./redis";

/**
 * Fixed-window rate limiting, over Redis when available and memory otherwise.
 *
 * The distinction matters: on a multi-instance deployment each process keeps
 * its own memory counters, so the effective limit multiplies by the instance
 * count. `createLimiter` at the bottom of this file picks the shared Redis
 * store whenever `REDIS_URL` is set, which is what makes the published limits
 * mean what they say in production.
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
 * Builds a limiter backed by Redis when one is configured, and by memory
 * otherwise.
 *
 * Resolution is deferred to first use rather than done at module load: route
 * modules are imported during the build, when `REDIS_URL` may not be set, and
 * an eagerly-chosen memory limiter would then be baked in for the process's
 * whole life.
 *
 * `namespace` keys the counter, so two limiters never share a budget and a
 * shared Redis can serve several environments.
 */
export function createLimiter(namespace: string, options: RateLimitOptions): RateLimiter {
  // Kept so a Redis outage falls back to a limiter with continuity, rather
  // than to a fresh empty one on every request.
  const fallback = createMemoryRateLimiter(options);

  return {
    async check(key: string): Promise<RateLimitResult> {
      const namespaced = `rl:${namespace}:${key}`;
      // Resolved per call, not once: the breaker can take Redis away and give
      // it back at any point in the process's life.
      const redis = getRedis();

      if (!redis) return fallback.check(namespaced);

      try {
        const result = await createRedisRateLimiter(redis, options).check(namespaced);
        noteRedisSuccess();
        return result;
      } catch (error) {
        noteRedisFailure();
        // A Redis outage must not take the site down with it. Failing open is
        // the right call for these limiters: they exist to blunt abuse, and
        // refusing every request would be a worse outage than the one we are
        // already having.
        console.error(`[rate-limit] ${namespace} falling back to memory`, error);
        // Fall back to the in-process counter rather than failing open: a
        // degraded limit is still a limit, and failing open during an outage
        // is exactly when abuse is cheapest.
        return fallback.check(namespaced);
      }
    },
  };
}

/**
 * The app's limiters.
 *
 * Analytics is generous — a real visitor clicking around a page produces
 * several events a minute and must never be throttled. Form submission is
 * tight because each row costs a human's attention. AI generation is tightest
 * because each call costs money; it sits in front of the monthly quota as a
 * burst guard, so a stuck client cannot spend a month's allowance in seconds.
 */
export const analyticsLimiter = createLimiter("events", { limit: 120, windowMs: 60_000 });
export const unlockLimiter = createLimiter("unlock", { limit: 10, windowMs: 60_000 });
export const formLimiter = createLimiter("form", { limit: 5, windowMs: 60_000 });
export const aiLimiter = createLimiter("ai", { limit: 5, windowMs: 60_000 });
