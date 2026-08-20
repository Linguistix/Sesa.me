import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRateLimiter, createRedisRateLimiter, type RedisLike } from "../rate-limit";

afterEach(() => vi.useRealTimers());

describe("createMemoryRateLimiter", () => {
  it("allows up to the limit then refuses", async () => {
    const limiter = createMemoryRateLimiter({ limit: 3, windowMs: 1000 });

    for (let i = 0; i < 3; i++) {
      expect((await limiter.check("k")).ok).toBe(true);
    }
    expect((await limiter.check("k")).ok).toBe(false);
  });

  it("reports the remaining budget", async () => {
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 1000 });
    expect((await limiter.check("k")).remaining).toBe(1);
    expect((await limiter.check("k")).remaining).toBe(0);
    expect((await limiter.check("k")).remaining).toBe(0);
  });

  it("keeps separate budgets per key", async () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("b")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(false);
  });

  it("resets once the window elapses", async () => {
    vi.useFakeTimers();
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1000 });

    expect((await limiter.check("k")).ok).toBe(true);
    expect((await limiter.check("k")).ok).toBe(false);

    vi.advanceTimersByTime(1001);
    expect((await limiter.check("k")).ok).toBe(true);
  });
});

describe("createRedisRateLimiter", () => {
  function fakeRedis(): RedisLike & { counts: Map<string, number> } {
    const counts = new Map<string, number>();
    return {
      counts,
      async incr(key) {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next;
      },
      async pexpire() {
        return 1;
      },
      async pttl() {
        return 500;
      },
    };
  }

  it("counts through the shared store", async () => {
    const redis = fakeRedis();
    const limiter = createRedisRateLimiter(redis, { limit: 2, windowMs: 1000 });

    expect((await limiter.check("k")).ok).toBe(true);
    expect((await limiter.check("k")).ok).toBe(true);
    expect((await limiter.check("k")).ok).toBe(false);
    expect(redis.counts.get("k")).toBe(3);
  });

  it("sets the expiry exactly once, on the first request of a window", async () => {
    const redis = fakeRedis();
    const pexpire = vi.spyOn(redis, "pexpire");
    const limiter = createRedisRateLimiter(redis, { limit: 5, windowMs: 1000 });

    await limiter.check("k");
    await limiter.check("k");
    await limiter.check("k");

    expect(pexpire).toHaveBeenCalledTimes(1);
  });
});
