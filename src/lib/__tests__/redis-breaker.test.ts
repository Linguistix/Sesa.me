import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRedis,
  isRedisDegraded,
  noteRedisFailure,
  noteRedisSuccess,
  resetRedisForTests,
} from "../redis";

beforeEach(() => {
  resetRedisForTests();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.useRealTimers();
  resetRedisForTests();
});

describe("without REDIS_URL", () => {
  it("reports unconfigured and never degraded", () => {
    expect(getRedis()).toBeNull();
    expect(isRedisDegraded()).toBe(false);
  });

  it("stays null however many failures are reported", () => {
    for (let i = 0; i < 10; i++) noteRedisFailure();
    expect(getRedis()).toBeNull();
    // Unconfigured is not the same state as degraded — a dashboard should be
    // able to tell "no Redis here" from "Redis is broken".
    expect(isRedisDegraded()).toBe(false);
  });
});

describe("circuit breaker", () => {
  beforeEach(() => {
    // A URL that will never connect; the tests drive the breaker directly.
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:63999");
  });

  it("stays closed below the failure threshold", () => {
    noteRedisFailure();
    noteRedisFailure();
    expect(isRedisDegraded()).toBe(false);
    expect(getRedis()).not.toBeNull();
  });

  it("opens on the third consecutive failure", () => {
    noteRedisFailure();
    noteRedisFailure();
    noteRedisFailure();

    expect(isRedisDegraded()).toBe(true);
    // Callers see null and take their fallback path immediately, without
    // paying a command timeout.
    expect(getRedis()).toBeNull();
  });

  it("is reset by a success, so intermittent errors do not trip it", () => {
    noteRedisFailure();
    noteRedisFailure();
    noteRedisSuccess();
    noteRedisFailure();
    noteRedisFailure();

    expect(isRedisDegraded()).toBe(false);
  });

  it("half-opens after the cooldown to probe for recovery", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 3; i++) noteRedisFailure();
    expect(getRedis()).toBeNull();

    vi.advanceTimersByTime(10_001);

    // One probe is let through rather than staying dark forever.
    expect(getRedis()).not.toBeNull();
  });

  it("re-opens immediately if the probe fails", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 3; i++) noteRedisFailure();
    vi.advanceTimersByTime(10_001);

    expect(getRedis()).not.toBeNull();
    // The probe failed: one more failure must re-open, not three.
    noteRedisFailure();
    expect(getRedis()).toBeNull();
  });

  it("closes for good once the probe succeeds", () => {
    vi.useFakeTimers();

    for (let i = 0; i < 3; i++) noteRedisFailure();
    vi.advanceTimersByTime(10_001);
    getRedis();
    noteRedisSuccess();

    expect(isRedisDegraded()).toBe(false);
    noteRedisFailure();
    expect(isRedisDegraded()).toBe(false);
  });
});
