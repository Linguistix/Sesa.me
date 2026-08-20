import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { createRedisRateLimiter } from "../rate-limit";

/**
 * Exercises the Redis path against a real server rather than a hand-written
 * fake. The fake in `rate-limit.test.ts` proves the call sequence; this proves
 * the semantics — that INCR + PEXPIRE actually produces a fixed window, and
 * that ioredis satisfies the `RedisLike` interface the limiter is typed
 * against.
 *
 * Skipped when no REDIS_TEST_URL is set, so the suite still runs anywhere.
 */
const url = process.env.REDIS_TEST_URL;
const describeIfRedis = url ? describe : describe.skip;

describeIfRedis("Redis-backed rate limiter", () => {
  let redis: Redis;
  const key = `test:${Math.random().toString(36).slice(2)}`;

  beforeAll(() => {
    redis = new Redis(url!, { maxRetriesPerRequest: 2 });
  });

  afterAll(async () => {
    const keys = await redis.keys(`${key}*`);
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  });

  beforeEach(async () => {
    const keys = await redis.keys(`${key}*`);
    if (keys.length > 0) await redis.del(...keys);
  });

  it("allows up to the limit, then refuses", async () => {
    const limiter = createRedisRateLimiter(redis, { limit: 3, windowMs: 5000 });

    for (let i = 0; i < 3; i++) {
      expect((await limiter.check(key)).ok).toBe(true);
    }
    expect((await limiter.check(key)).ok).toBe(false);
  });

  it("counts down the remaining budget", async () => {
    const limiter = createRedisRateLimiter(redis, { limit: 2, windowMs: 5000 });

    expect((await limiter.check(key)).remaining).toBe(1);
    expect((await limiter.check(key)).remaining).toBe(0);
  });

  it("keeps separate budgets per key", async () => {
    const limiter = createRedisRateLimiter(redis, { limit: 1, windowMs: 5000 });

    expect((await limiter.check(`${key}:a`)).ok).toBe(true);
    expect((await limiter.check(`${key}:b`)).ok).toBe(true);
    expect((await limiter.check(`${key}:a`)).ok).toBe(false);
  });

  it("sets a real expiry, so the window actually resets", async () => {
    const limiter = createRedisRateLimiter(redis, { limit: 1, windowMs: 1000 });

    expect((await limiter.check(key)).ok).toBe(true);
    expect((await limiter.check(key)).ok).toBe(false);

    const ttl = await redis.pttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1000);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await limiter.check(key)).ok).toBe(true);
  });

  it("shares one budget across separate limiter instances — the whole point", async () => {
    // Two instances stand in for two app processes behind a load balancer.
    const instanceA = createRedisRateLimiter(redis, { limit: 2, windowMs: 5000 });
    const instanceB = createRedisRateLimiter(redis, { limit: 2, windowMs: 5000 });

    expect((await instanceA.check(key)).ok).toBe(true);
    expect((await instanceB.check(key)).ok).toBe(true);
    // The third request is refused regardless of which process receives it.
    expect((await instanceA.check(key)).ok).toBe(false);
    expect((await instanceB.check(key)).ok).toBe(false);
  });
});
