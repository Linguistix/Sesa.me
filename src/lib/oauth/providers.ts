/**
 * OAuth providers a creator can connect for read-only data access.
 *
 * These grants are *authorization*, not authentication: connecting Spotify
 * says "you may read my releases", not "this is who I am". Keeping them
 * separate from sign-in is why the flow below is explicit rather than folded
 * into Auth.js — a data grant should never be able to become a login.
 */

export type ProviderId = "spotify" | "google";

export interface OAuthProvider {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  /**
   * Least privilege. Spotify needs the user's identity plus their own albums;
   * Google needs read-only YouTube. Neither asks for anything writable.
   */
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Providers that require the client secret in the body rather than Basic auth. */
  tokenAuth: "basic" | "body";
  /** Extra parameters some providers require on the authorize request. */
  extraAuthorizeParams?: Record<string, string>;
}

export const PROVIDERS: Record<ProviderId, OAuthProvider> = {
  spotify: {
    id: "spotify",
    label: "Spotify",
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: ["user-read-private", "user-read-email", "user-library-read"],
    clientIdEnv: "SPOTIFY_CLIENT_ID",
    clientSecretEnv: "SPOTIFY_CLIENT_SECRET",
    tokenAuth: "basic",
  },
  google: {
    id: "google",
    label: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    tokenAuth: "body",
    extraAuthorizeParams: {
      // Google only returns a refresh token on the first consent unless both
      // of these are set — without them a reconnect yields an access token
      // that expires in an hour and can never be renewed.
      access_type: "offline",
      prompt: "consent",
    },
  },
};

export function isProviderId(value: string): value is ProviderId {
  // `in` walks the prototype chain, so `"__proto__" in PROVIDERS` is true and
  // `PROVIDERS["__proto__"]` then yields Object.prototype — an object with
  // none of the fields the caller expects. Own-property check only.
  return Object.hasOwn(PROVIDERS, value);
}

export function providerCredentials(
  provider: OAuthProvider,
): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isProviderConfigured(id: ProviderId): boolean {
  return providerCredentials(PROVIDERS[id]) !== null;
}

/** Providers with credentials present, for the connections UI. */
export function configuredProviders(): OAuthProvider[] {
  return Object.values(PROVIDERS).filter((p) => isProviderConfigured(p.id));
}

/**
 * Endpoint overrides for tests.
 *
 * Lets the suite point the flow at a local mock provider without any
 * conditional branching in the flow itself — the code under test is the same
 * code that runs in production.
 */
export function resolveEndpoints(provider: OAuthProvider): {
  authorizeUrl: string;
  tokenUrl: string;
} {
  const base = process.env[`OAUTH_${provider.id.toUpperCase()}_BASE_URL`];
  if (!base) return { authorizeUrl: provider.authorizeUrl, tokenUrl: provider.tokenUrl };

  const trimmed = base.replace(/\/+$/, "");
  return { authorizeUrl: `${trimmed}/authorize`, tokenUrl: `${trimmed}/token` };
}
