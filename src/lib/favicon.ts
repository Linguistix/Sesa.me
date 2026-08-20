/**
 * Favicon fallback for link blocks.
 *
 * When a creator gives a link neither an emoji nor an icon, the destination's
 * own favicon is a better default than a blank space.
 *
 * The icon is loaded from the destination's own origin rather than a
 * third-party favicon service. A service would tell that provider which pages
 * every visitor loads and which links they see — a privacy cost the analytics
 * pipeline was carefully designed to avoid, so it would be odd to reintroduce
 * it for decoration.
 */
export function faviconUrl(target: string | null): string | null {
  if (!target) return null;

  try {
    const url = new URL(target);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}/favicon.ico`;
  } catch {
    return null;
  }
}
