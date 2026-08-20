import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PROVIDERS, isProviderId, providerCredentials } from "@/lib/oauth/providers";
import { codeChallenge, createCodeVerifier, createState } from "@/lib/oauth/pkce";
import { OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE, authorizationUrl } from "@/server/connections";
import { appUrl } from "@/lib/urls";

/**
 * Begins a connection flow.
 *
 * The state and the PKCE verifier are held in an httpOnly cookie rather than
 * in a database row or a signed token: the browser that started the flow is
 * exactly what needs to be proven, and a cookie the page's own JavaScript
 * cannot read is the cheapest way to prove it.
 *
 * `SameSite=Lax` rather than `Strict`, because the cookie must survive the
 * top-level redirect back from the provider — `Strict` would drop it and every
 * callback would fail state validation.
 */
export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(appUrl("/login"), 302);
  }

  const { provider: providerParam } = await context.params;
  if (!isProviderId(providerParam)) {
    return NextResponse.redirect(appUrl("/dashboard/connections?error=unknown_provider"), 302);
  }

  const provider = PROVIDERS[providerParam];
  const credentials = providerCredentials(provider);
  if (!credentials) {
    return NextResponse.redirect(appUrl("/dashboard/connections?error=not_configured"), 302);
  }

  const state = createState();
  const verifier = createCodeVerifier();

  const response = NextResponse.redirect(
    authorizationUrl({
      provider,
      clientId: credentials.clientId,
      state,
      challenge: codeChallenge(verifier),
    }),
    302,
  );

  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, provider: provider.id }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/connections",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  });

  return response;
}
