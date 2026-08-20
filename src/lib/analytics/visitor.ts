import { createHash } from "node:crypto";

/**
 * Turns a request's identifying signals into a hash that can count unique
 * visitors without storing anything that identifies a person.
 *
 * Three properties matter:
 *  - The IP address never reaches the database, only this digest.
 *  - The digest is salted with the day, so the same visitor produces a
 *    different hash tomorrow and cannot be tracked across days.
 *  - The salt is server-side, so the digest cannot be reversed by anyone who
 *    obtains the analytics table.
 *
 * This is what keeps the analytics pipeline on the right side of GDPR: there
 * is no personal data at rest, only a daily-rotating pseudonym.
 */
export function visitorHash(params: {
  ip: string | null;
  userAgent: string | null;
  pageId: string;
  /** Injectable for tests; defaults to today in UTC. */
  date?: Date;
}): string {
  const day = (params.date ?? new Date()).toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? "sesame-dev-salt";

  return createHash("sha256")
    .update([salt, day, params.pageId, params.ip ?? "", params.userAgent ?? ""].join("|"))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Classifies a user agent into the three buckets the dashboard reports.
 * Deliberately coarse — the goal is "where do I need to look good", not
 * fingerprinting.
 */
export function deviceFromUserAgent(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();

  // Order matters: an iPad reports "mobile" in some browsers' UA strings.
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Reduces a referrer to its registrable host, which is all the traffic-source
 * report needs. Self-referrals and unparseable values become null so they do
 * not pollute the breakdown.
 */
export function sourceFromReferrer(referrer: string | null, selfHost?: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host.replace(/^www\./, "");
    if (!host) return null;
    if (selfHost && host === selfHost.replace(/^www\./, "")) return null;
    return host.slice(0, 128);
  } catch {
    return null;
  }
}

/**
 * Extracts the client IP from the proxy headers a CDN sets.
 *
 * `x-forwarded-for` is a client-controlled header when there is no proxy in
 * front, but it is only ever fed into a salted hash here, so a spoofed value
 * can at worst inflate this visitor's own uniqueness — it cannot forge another
 * visitor or escape the hash.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || null;
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip");
}

/** Country from the CDN's geo header, if the platform provides one. */
export function clientCountry(headers: Headers): string | null {
  const raw =
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-geo-country");

  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}
