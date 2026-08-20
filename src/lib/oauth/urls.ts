/**
 * Confirms a provider-supplied URL is https and on the host we expect.
 *
 * The response comes from a third party over the network. It is almost
 * certainly fine — but "almost certainly" is not the standard for a value
 * about to become an `href` on a public page.
 *
 * Kept free of server-only imports so it can be unit-tested and reused
 * anywhere; the server module re-exports it.
 */
export function isSafeProviderUrl(url: string, expectedHost: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.host === expectedHost;
  } catch {
    return false;
  }
}
