/**
 * Absolute URLs for QR codes, share sheets and metadata.
 *
 * Falls back to localhost so a fresh clone works with no configuration, but
 * production must set NEXT_PUBLIC_APP_URL or every QR code points at a laptop.
 */
export function baseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export function appUrl(path: string): string {
  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The host shown next to a slug in the UI, e.g. "sesa.me". */
export function displayHost(): string {
  try {
    return new URL(baseUrl()).host;
  } catch {
    return "sesa.me";
  }
}
