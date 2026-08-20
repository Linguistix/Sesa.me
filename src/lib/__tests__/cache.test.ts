import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheDelete, cacheGet, cacheSet, cached, clearMemoryCache, publicPageKey } from "../cache";

beforeEach(() => {
  clearMemoryCache();
  vi.unstubAllEnvs();
});
afterEach(() => vi.useRealTimers());

describe("memory cache (no REDIS_URL)", () => {
  it("round-trips a value", async () => {
    await cacheSet("k", { a: 1 }, 60);
    expect(await cacheGet("k")).toEqual({ a: 1 });
  });

  it("returns null for an unknown key", async () => {
    expect(await cacheGet("nope")).toBeNull();
  });

  it("expires entries", async () => {
    vi.useFakeTimers();
    await cacheSet("k", "v", 1);
    expect(await cacheGet("k")).toBe("v");

    vi.advanceTimersByTime(1001);
    expect(await cacheGet("k")).toBeNull();
  });

  it("deletes on demand", async () => {
    await cacheSet("k", "v", 60);
    await cacheDelete("k");
    expect(await cacheGet("k")).toBeNull();
  });
});

describe("cached()", () => {
  it("computes on a miss and serves the cached value afterwards", async () => {
    const compute = vi.fn().mockResolvedValue({ hit: true });

    expect(await cached("k", 60, compute)).toEqual({ hit: true });
    expect(await cached("k", 60, compute)).toEqual({ hit: true });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does not cache null, so a newly created page is not hidden for a TTL", async () => {
    const compute = vi.fn().mockResolvedValue(null);

    expect(await cached("missing", 60, compute)).toBeNull();
    expect(await cached("missing", 60, compute)).toBeNull();
    // Recomputed both times rather than remembering "does not exist".
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("recomputes after invalidation", async () => {
    const compute = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    expect(await cached("k", 60, compute)).toBe("first");
    await cacheDelete("k");
    expect(await cached("k", 60, compute)).toBe("second");
  });
});

describe("publicPageKey", () => {
  it("is case-insensitive, matching slug lookup", () => {
    expect(publicPageKey("Camille")).toBe(publicPageKey("camille"));
  });

  it("namespaces keys so they cannot collide with other caches", () => {
    expect(publicPageKey("camille")).toBe("page:camille");
  });
});
