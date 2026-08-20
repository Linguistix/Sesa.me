import { NextResponse } from "next/server";
import { resolveShortLink } from "@/server/shortlinks";
import { ingest } from "@/server/analytics";
import { isValidCode } from "@/lib/shortcode";
import { isInAppBrowser, toDeepLink } from "@/lib/deeplinks";
import { deepLinkInterstitial } from "@/lib/deeplink-page";
import {
  clientCountry,
  clientIp,
  deviceFromUserAgent,
  sourceFromReferrer,
  visitorHash,
} from "@/lib/analytics/visitor";
import { displayHost } from "@/lib/urls";

/**
 * Short-link redirector: `/u/<code>` → the destination.
 *
 * A route handler rather than a page, so the response is a bare 302 with no
 * HTML to parse — the hop is invisible to the visitor. The click is recorded
 * here rather than in the browser because the redirect leaves no page behind
 * to run a beacon, which also makes short-link stats immune to ad blockers.
 */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;

  if (!isValidCode(code)) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const shortLink = await resolveShortLink(code);
  if (!shortLink) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const userAgent = request.headers.get("user-agent");

  // Recorded before redirecting so the write is not cut short by the browser
  // following the Location header. It is one indexed insert.
  await ingest({
    pageId: shortLink.pageId,
    linkId: shortLink.linkId,
    type: "LINK_CLICK",
    source: sourceFromReferrer(request.headers.get("referer"), displayHost()),
    country: clientCountry(request.headers),
    device: deviceFromUserAgent(userAgent),
    visitorHash: visitorHash({ ip: clientIp(request.headers), userAgent, pageId: shortLink.pageId }),
  });

  // Inside Instagram's or TikTok's embedded browser, an https link stays in
  // the webview even when the target app is installed, because those browsers
  // ignore Universal Links. There, and only there, serve the interstitial that
  // attempts the app's own scheme with a timed fallback to the web.
  const deepLink = isInAppBrowser(userAgent) ? toDeepLink(shortLink.targetUrl) : null;

  if (deepLink) {
    return new NextResponse(deepLinkInterstitial(deepLink, hostOf(shortLink.targetUrl)), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  const response = NextResponse.redirect(shortLink.targetUrl, 302);
  // Short links must never be cached: the whole point is that every hit counts.
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

/** Host of a URL, for the interstitial's visible fallback label. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "la page";
  }
}
