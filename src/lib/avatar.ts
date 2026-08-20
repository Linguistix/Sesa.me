/**
 * Avatar rules.
 *
 * Animated avatars are a Pro feature (§1.10), which means the plan check has
 * to happen somewhere real rather than in the UI alone — a Free user can edit
 * the URL field directly, and the public page is what actually renders it.
 */

const ANIMATED_EXTENSIONS = [".gif", ".webp", ".apng", ".avifs"];

/**
 * Whether a URL looks like an animated image.
 *
 * Extension-based, and deliberately so: the alternative is fetching and
 * sniffing every avatar on every save, which turns a profile edit into an
 * outbound request to an address the user controls — an SSRF surface bought
 * for a check a determined user can defeat anyway by renaming a file.
 *
 * The cost of a false negative is one Free user with an animated avatar. The
 * cost of the "thorough" version is a request forgery vector, so this is the
 * right trade.
 */
export function looksAnimated(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return ANIMATED_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/** Whether `plan` may use this avatar. */
export function avatarAllowed(url: string | null, canAnimate: boolean): boolean {
  if (!url) return true;
  return canAnimate || !looksAnimated(url);
}
