/**
 * Analytics consent, stored locally in the visitor's browser.
 *
 * The pipeline itself is cookieless and stores no personal data — only a
 * daily-rotating salted hash — but the brief asks for an explicit consent
 * banner, and honouring a refusal costs nothing. "Refused" is remembered so
 * the banner does not nag on every visit.
 */

export const CONSENT_KEY = "sesame.analytics-consent";

export type ConsentValue = "granted" | "denied";

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    // Private browsing modes can throw on localStorage access.
    return null;
  }
}

export function writeConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Nothing to do: consent simply will not persist across visits.
  }
}

/**
 * Whether measurement may run right now.
 *
 * Also honours Global Privacy Control and Do Not Track: a visitor who has set
 * either has already answered the question at the browser level, so we treat
 * it as a refusal and never show the banner.
 */
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (signalsOptOut()) return false;
  return readConsent() === "granted";
}

export function signalsOptOut(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}
