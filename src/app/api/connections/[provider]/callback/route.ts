import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { PROVIDERS, isProviderId } from "@/lib/oauth/providers";
import { statesMatch } from "@/lib/oauth/pkce";
import { OAUTH_COOKIE, exchangeCode, saveConnection } from "@/server/connections";
import { fetchProviderIdentity } from "@/server/provider-data";
import { appUrl } from "@/lib/urls";

function back(status: string) {
  return NextResponse.redirect(appUrl(`/dashboard/connections?status=${status}`), 302);
}

/**
 * Completes a connection flow.
 *
 * Every failure path lands the user back on the connections page with a status
 * rather than showing an error page: this is a redirect the provider sent them
 * on, and a raw 400 in the middle of it is indistinguishable from a broken
 * site.
 */
export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(appUrl("/login"), 302);

  const { provider: providerParam } = await context.params;
  if (!isProviderId(providerParam)) return back("unknown_provider");

  const url = new URL(request.url);
  const cookieStore = await cookies();

  // The flow is over either way; clear the cookie before anything can fail so
  // a stale verifier cannot be replayed.
  const raw = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);

  // The user declined on the provider's screen. Not an error.
  if (url.searchParams.get("error")) return back("cancelled");

  if (!raw) return back("expired");

  let flow: { state: string; verifier: string; provider: string };
  try {
    flow = JSON.parse(raw);
  } catch {
    return back("expired");
  }

  // A callback for a different provider than the one this flow started means
  // the request was not produced by that flow.
  if (flow.provider !== providerParam) return back("state_mismatch");

  const returnedState = url.searchParams.get("state") ?? "";
  if (!statesMatch(flow.state, returnedState)) return back("state_mismatch");

  const code = url.searchParams.get("code");
  if (!code) return back("no_code");

  const provider = PROVIDERS[providerParam];

  try {
    const tokens = await exchangeCode({ provider, code, verifier: flow.verifier });
    const identity = await fetchProviderIdentity(provider.id, tokens.access_token);

    await saveConnection({
      userId: session.user.id,
      provider: provider.id,
      providerAccountId: identity.id,
      accountLabel: identity.label,
      tokens,
    });

    return back("connected");
  } catch (error) {
    console.error(`[oauth] ${provider.id} callback failed`, error);
    return back("failed");
  }
}
