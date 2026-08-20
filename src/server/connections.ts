import "server-only";
import { prisma } from "@/lib/db";
import {
  PROVIDERS,
  providerCredentials,
  resolveEndpoints,
  type OAuthProvider,
  type ProviderId,
} from "@/lib/oauth/providers";
import { appUrl } from "@/lib/urls";

export const OAUTH_COOKIE = "sesame_oauth";
/** The flow is a redirect round-trip, not a session; minutes, not hours. */
export const OAUTH_COOKIE_MAX_AGE = 600;

export function redirectUri(provider: ProviderId): string {
  return appUrl(`/api/connections/${provider}/callback`);
}

/** Builds the provider's authorization URL for a prepared flow. */
export function authorizationUrl(params: {
  provider: OAuthProvider;
  clientId: string;
  state: string;
  challenge: string;
}): string {
  const { authorizeUrl } = resolveEndpoints(params.provider);
  const url = new URL(authorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", redirectUri(params.provider.id));
  url.searchParams.set("scope", params.provider.scopes.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");

  for (const [key, value] of Object.entries(params.provider.extraAuthorizeParams ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

/**
 * Exchanges an authorization code (or a refresh token) for tokens.
 *
 * Providers disagree on where the client secret goes — Spotify wants HTTP
 * Basic, Google wants it in the body — so the provider record says which,
 * rather than this trying both and leaking the secret to whichever answers.
 */
export async function requestToken(
  provider: OAuthProvider,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const credentials = providerCredentials(provider);
  if (!credentials) throw new Error(`${provider.label} is not configured.`);

  const { tokenUrl } = resolveEndpoints(provider);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  const params = new URLSearchParams(body);

  if (provider.tokenAuth === "basic") {
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
      "base64",
    );
    headers.Authorization = `Basic ${basic}`;
  } else {
    params.set("client_id", credentials.clientId);
    params.set("client_secret", credentials.clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body: params,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // The body can echo request parameters, so it is logged, never surfaced.
    console.error(`[oauth] ${provider.id} token request failed`, response.status, detail.slice(0, 300));
    throw new Error(`${provider.label} a refusé la demande.`);
  }

  return (await response.json()) as TokenResponse;
}

export async function exchangeCode(params: {
  provider: OAuthProvider;
  code: string;
  verifier: string;
}): Promise<TokenResponse> {
  return requestToken(params.provider, {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: redirectUri(params.provider.id),
    code_verifier: params.verifier,
  });
}

/**
 * Stores or updates the grant. Called once per successful callback.
 *
 * The upsert is keyed on (provider, providerAccountId), so one provider
 * account maps to at most one Sesame account and the most recent link wins.
 * If a second user connects a Spotify account already linked elsewhere, the
 * grant moves to them — which is correct, since completing the flow is proof
 * of control, and the first user can no longer offer that proof. Their synced
 * blocks keep their last resolved content and start reporting "compte non
 * connecté" in the editor rather than failing silently.
 */
export async function saveConnection(params: {
  userId: string;
  provider: ProviderId;
  providerAccountId: string;
  accountLabel: string | null;
  tokens: TokenResponse;
}) {
  const expiresAt = params.tokens.expires_in
    ? Math.floor(Date.now() / 1000) + params.tokens.expires_in
    : null;

  return prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: params.provider,
        providerAccountId: params.providerAccountId,
      },
    },
    create: {
      userId: params.userId,
      type: "oauth",
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      accountLabel: params.accountLabel,
      access_token: params.tokens.access_token,
      refresh_token: params.tokens.refresh_token ?? null,
      expires_at: expiresAt,
      scope: params.tokens.scope ?? null,
      token_type: params.tokens.token_type ?? null,
    },
    update: {
      userId: params.userId,
      accountLabel: params.accountLabel,
      access_token: params.tokens.access_token,
      // A refresh grant often omits the refresh token; overwriting with null
      // would silently make the connection expire in an hour, permanently.
      ...(params.tokens.refresh_token ? { refresh_token: params.tokens.refresh_token } : {}),
      expires_at: expiresAt,
      scope: params.tokens.scope ?? null,
    },
  });
}

export async function listConnections(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId, type: "oauth" },
    select: { provider: true, accountLabel: true, expires_at: true, createdAt: true },
  });

  return accounts.map((account) => ({
    provider: account.provider as ProviderId,
    label: PROVIDERS[account.provider as ProviderId]?.label ?? account.provider,
    accountLabel: account.accountLabel,
    connectedAt: account.createdAt,
  }));
}

export async function disconnect(userId: string, provider: ProviderId): Promise<boolean> {
  const [result] = await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, provider } }),
    // Blocks that were syncing from this provider stop syncing but keep the
    // content they last resolved — deleting the block would lose a creator's
    // layout because a token expired.
    prisma.link.updateMany({
      where: {
        page: { userId },
        syncProvider: provider === "spotify" ? "SPOTIFY_LATEST_RELEASE" : "YOUTUBE_LATEST_VIDEO",
      },
      data: {
        syncProvider: null,
        syncError: "Compte déconnecté — le bloc ne se met plus à jour.",
      },
    }),
  ]);

  return result.count > 0;
}

/**
 * Returns a usable access token, refreshing it first if it is close to expiry.
 *
 * The 60-second margin exists because a token that is valid when checked can
 * expire during the request that uses it. Returns null when the grant cannot
 * be renewed, which is the signal that the user must reconnect.
 */
export async function accessTokenFor(
  userId: string,
  providerId: ProviderId,
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: providerId },
  });

  if (!account?.access_token) return null;

  const expiresAt = account.expires_at ?? 0;
  const stillValid = expiresAt === 0 || expiresAt * 1000 - Date.now() > 60_000;
  if (stillValid) return account.access_token;

  if (!account.refresh_token) return null;

  try {
    const tokens = await requestToken(PROVIDERS[providerId], {
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    });

    await saveConnection({
      userId,
      provider: providerId,
      providerAccountId: account.providerAccountId,
      accountLabel: account.accountLabel,
      tokens,
    });

    return tokens.access_token;
  } catch (error) {
    console.error(`[oauth] ${providerId} refresh failed`, error);
    return null;
  }
}
