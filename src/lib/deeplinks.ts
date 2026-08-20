/**
 * Native app deep links.
 *
 * A link opened from an Instagram or TikTok bio runs inside that app's
 * embedded browser, where a normal https URL keeps the visitor trapped in a
 * webview — not signed in, no app features. Handing the OS a URL the target
 * app claims instead hands the visitor to the real app.
 *
 * Two mechanisms exist and they are not interchangeable:
 *
 *  - **Universal Links (iOS) / App Links (Android)** are just the https URL.
 *    The OS recognises the domain and routes it to the installed app, falling
 *    back to the browser when the app is absent. This is the correct default:
 *    it degrades safely and needs nothing from us.
 *  - **Custom schemes** (`spotify:`, `vnd.youtube:`) open the app directly but
 *    fail *visibly* — a blank tab or an error — when the app is not installed.
 *
 * So the scheme is only ever used where the app's absence can be detected and
 * recovered from, which is why `nativeUrl` is returned separately from the
 * https URL rather than replacing it.
 */

export interface DeepLink {
  /** Custom-scheme URL that opens the native app, when one is known. */
  nativeUrl: string;
  /** The original https URL, used as the fallback. */
  webUrl: string;
}

const ID = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * Derives a native-scheme URL for a known provider.
 *
 * Returns null when the URL is unrecognised, which is the common case and
 * simply means the https URL is used unchanged.
 */
export function toDeepLink(rawUrl: string): DeepLink | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.host.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);
  const webUrl = url.toString();

  // Spotify: the URI form mirrors the path — /track/<id> -> spotify:track:<id>
  if (host === "open.spotify.com") {
    const path = segments[0]?.startsWith("intl-") ? segments.slice(1) : segments;
    const [kind, id] = path;
    if (kind && id && ID.test(id)) {
      return { nativeUrl: `spotify:${kind}:${id}`, webUrl };
    }
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    const videoId = host === "youtu.be" ? segments[0] : url.searchParams.get("v") ?? segments[1];
    if (videoId && ID.test(videoId)) {
      return { nativeUrl: `vnd.youtube://${videoId}`, webUrl };
    }
  }

  if (host === "instagram.com") {
    const username = segments[0];
    if (username && ID.test(username) && segments.length === 1) {
      return { nativeUrl: `instagram://user?username=${username}`, webUrl };
    }
  }

  if (host === "twitter.com" || host === "x.com") {
    const username = segments[0];
    if (username && ID.test(username) && segments.length === 1) {
      return { nativeUrl: `twitter://user?screen_name=${username}`, webUrl };
    }
  }

  if (host === "tiktok.com") {
    // TikTok profile URLs are /@handle
    const handle = segments[0];
    if (handle?.startsWith("@") && ID.test(handle.slice(1))) {
      return { nativeUrl: `snssdk1128://user/profile/${handle.slice(1)}`, webUrl };
    }
  }

  return null;
}

/**
 * Detects the embedded browsers where deep linking actually pays off.
 *
 * Outside these, a normal https link already reaches the installed app via
 * Universal/App Links, and forcing a scheme would only add a failure mode.
 */
export function isInAppBrowser(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|Snapchat|Twitter/i.test(userAgent);
}
