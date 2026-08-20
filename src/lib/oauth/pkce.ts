import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * PKCE and CSRF state for the authorization-code flow.
 *
 * PKCE (RFC 7636) was designed for public clients, but it matters here too:
 * it binds the authorization code to the browser that started the flow, so a
 * code intercepted from the redirect — via a referrer leak, a shared device,
 * or a malicious browser extension — cannot be exchanged by anyone else.
 */

/** base64url, which is what the RFC requires — not standard base64. */
function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636 requires 43–128 characters; 32 random bytes gives 43. */
export function createCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function codeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function createState(): string {
  return base64url(randomBytes(16));
}

/**
 * Compares two state values in constant time.
 *
 * The timing difference on a string compare is tiny, but state comparison is
 * cheap to do correctly and this is the check that stands between a user and
 * a CSRF-forced account link.
 */
export function statesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
