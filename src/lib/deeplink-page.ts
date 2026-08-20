import type { DeepLink } from "./deeplinks";

/**
 * Escapes a string for use inside an HTML attribute value.
 *
 * The URLs below are attacker-influenced (a page owner types them), so they
 * are placed in data attributes and escaped here rather than interpolated
 * into a script body — there is no context switch a quote can escape from.
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * An interstitial that hands the visitor to a native app, falling back to the
 * web.
 *
 * This exists because Instagram's and TikTok's embedded browsers ignore
 * Universal Links: an https link that would open the Spotify app in Safari
 * stays inside the webview instead. The workaround is to attempt the custom
 * scheme and race it against a timer — if the app takes over, the page is
 * backgrounded and the timer never fires; if it does not, the timer redirects
 * to the web URL.
 *
 * `pagehide`/`visibilitychange` cancel the fallback, because a browser that
 * successfully handed off can still fire the timer when the visitor returns,
 * which would bounce them to the website they just left the app to avoid.
 *
 * The page is served with `noindex` and never cached: it is a mechanism, not
 * content.
 */
export function deepLinkInterstitial(link: DeepLink, label: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Ouverture…</title>
<style>
  :root { color-scheme: dark }
  body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center;
    background: #0B0B0F; color: #E5E5E5;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    text-align: center; padding: 24px;
  }
  a { color: #818CF8 }
</style>
</head>
<body data-native="${escapeAttribute(link.nativeUrl)}" data-web="${escapeAttribute(link.webUrl)}">
  <main>
    <p>Ouverture de l&rsquo;application&hellip;</p>
    <p><a id="fallback" href="${escapeAttribute(link.webUrl)}">Continuer vers ${escapeAttribute(label)}</a></p>
  </main>
  <script>
    (function () {
      var body = document.body;
      var native = body.getAttribute("data-native");
      var web = body.getAttribute("data-web");
      var settled = false;

      function settle() { settled = true; }
      window.addEventListener("pagehide", settle);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") settle();
      });

      // Fall back to the web URL if the app did not take over in time.
      setTimeout(function () {
        if (!settled) window.location.replace(web);
      }, 1200);

      window.location.href = native;
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=${escapeAttribute(link.webUrl)}">
  </noscript>
</body>
</html>`;
}
