import { getRedis, noteRedisFailure, noteRedisSuccess } from "./redis";

/**
 * A small read-through cache, shared across instances when Redis is
 * configured and per-process otherwise.
 *
 * Next's own `revalidate` already caches rendered pages, so this is not a
 * second rendering cache — it caches the *database read* behind them, which is
 * what a cold instance, an on-demand revalidation, or a metadata request all
 * pay for individually. On a fleet, one instance warming the entry serves the
 * rest.
 *
 * Values are JSON, so anything cached must be plain data. That is a deliberate
 * limit: it stops a `Date` or a Prisma model from being cached and silently
 * coming back as a string.
 */

interface Entry {
  value: string;
  expiresAt: number;
}

const memory = new Map<string, Entry>();

/** Bounded so a process cannot grow a cache entry per slug forever. */
const MEMORY_MAX_ENTRIES = 1000;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();

  if (redis) {
    try {
      const raw = await redis.get(key);
      noteRedisSuccess();
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      // A cache miss is always a safe answer; the caller recomputes. Reporting
      // it lets the breaker open, so an outage costs one timeout rather than
      // one per request.
      noteRedisFailure();
      console.error("[cache] read failed", error);
      return null;
    }
  }

  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);
  const redis = getRedis();

  if (redis) {
    try {
      await redis.set(key, serialized, "EX", ttlSeconds);
      noteRedisSuccess();
    } catch (error) {
      noteRedisFailure();
      console.error("[cache] write failed", error);
    }
    return;
  }

  if (memory.size >= MEMORY_MAX_ENTRIES) evictExpired();
  memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      await redis.del(key);
      noteRedisSuccess();
    } catch (error) {
      // A failed invalidation is the one case that is genuinely unsafe: the
      // stale entry outlives the edit. The TTL bounds it to 60s, and the
      // memory fallback below is written to as well so a degraded instance
      // does not keep serving its own stale copy.
      noteRedisFailure();
      console.error("[cache] delete failed", error);
    }
    memory.delete(key);
    return;
  }

  memory.delete(key);
}

/**
 * Read-through helper.
 *
 * A miss recomputes and caches; a `null` result is *not* cached, because the
 * common null here is "no such page", and caching that would keep a freshly
 * created page invisible for the whole TTL.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T | null>,
): Promise<T | null> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const value = await compute();
  if (value !== null) await cacheSet(key, value, ttlSeconds);
  return value;
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }
  // Still full of live entries: drop the oldest insertions, which Map
  // iterates first.
  if (memory.size >= MEMORY_MAX_ENTRIES) {
    let toDrop = Math.ceil(MEMORY_MAX_ENTRIES / 4);
    for (const key of memory.keys()) {
      memory.delete(key);
      if (--toDrop <= 0) break;
    }
  }
}

/** Cache key for a public page's resolved data. */
export function publicPageKey(slug: string): string {
  return `page:${slug.toLowerCase()}`;
}

/** Testing seam. */
export function clearMemoryCache(): void {
  memory.clear();
}
