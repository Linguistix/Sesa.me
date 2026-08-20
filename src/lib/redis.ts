import Redis from "ioredis";

/**
 * Redis is optional.
 *
 * Without `REDIS_URL` the app runs on in-process fallbacks: rate limits are
 * per-instance and the page cache is per-instance. That is correct for a
 * single process and wrong for a fleet, which is why the limiters and the
 * cache both read through this module rather than constructing their own
 * client — flipping one environment variable switches every consumer at once.
 */
let cached: Redis | null | undefined;

/**
 * Timeouts must be short, not merely finite.
 *
 * These sit on the public page's hot path. A cache read that takes longer than
 * this is already slower than recomputing from Postgres, so waiting for it is
 * strictly worse than giving up on it.
 */
const CONNECT_TIMEOUT_MS = 3_000;
const COMMAND_TIMEOUT_MS = 200;

// --- Circuit breaker -------------------------------------------------------

/**
 * Without a breaker, a Redis outage costs every single request a full command
 * timeout — turning a 15ms page into a slow one and blowing the latency budget
 * across the whole site. Measured: 2.8s per page against a refused connection.
 *
 * So after a few consecutive failures the circuit opens and callers skip Redis
 * entirely, falling back in microseconds instead of milliseconds. One probe is
 * allowed through after the cooldown to notice recovery.
 */
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 10_000;

let consecutiveFailures = 0;
let openedAt = 0;

function circuitOpen(): boolean {
  if (openedAt === 0) return false;

  if (Date.now() - openedAt >= COOLDOWN_MS) {
    // Half-open: let the next command through to test the water. If it fails,
    // `noteFailure` re-opens immediately.
    openedAt = 0;
    consecutiveFailures = FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
}

/** Called by consumers when a Redis command fails. */
export function noteRedisFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD && openedAt === 0) {
    openedAt = Date.now();
    console.error(`[redis] circuit opened after ${consecutiveFailures} failures`);
  }
}

/** Called by consumers when a Redis command succeeds. */
export function noteRedisSuccess(): void {
  if (consecutiveFailures !== 0 || openedAt !== 0) {
    consecutiveFailures = 0;
    openedAt = 0;
  }
}

/**
 * The live client, or null when Redis is unconfigured *or* currently being
 * skipped by the breaker. Callers treat both the same way: use the fallback.
 */
export function getRedis(): Redis | null {
  const client = connect();
  if (!client) return null;
  return circuitOpen() ? null : client;
}

function connect(): Redis | null {
  if (cached !== undefined) return cached;

  const url = process.env.REDIS_URL;
  if (!url) {
    cached = null;
    return cached;
  }

  const client = new Redis(url, {
    // The offline queue stays ON. Disabling it looks like the cautious choice,
    // but it rejects every command issued while the socket is still opening —
    // which on a cold instance means the first requests silently bypass the
    // rate limiter and miss the cache. Startup is not an outage.
    enableOfflineQueue: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    commandTimeout: COMMAND_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 3_000),
  });

  // An unhandled 'error' event on an ioredis client crashes the process.
  client.on("error", (error) => {
    noteRedisFailure();
    console.error("[redis] connection error", error.message);
  });

  client.on("ready", () => noteRedisSuccess());

  cached = client;
  return cached;
}

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/** True when Redis is configured but currently being skipped. */
export function isRedisDegraded(): boolean {
  return isRedisConfigured() && circuitOpen();
}

/** Testing seam: drops the memoised client and resets the breaker. */
export function resetRedisForTests(): void {
  cached = undefined;
  consecutiveFailures = 0;
  openedAt = 0;
}
