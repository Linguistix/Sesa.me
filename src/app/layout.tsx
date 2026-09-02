import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * The interface typeface.
 *
 * Rubik, served from our own origin. A webfont fetched from a third party at
 * runtime is a request that can stall, and this one would stall the whole
 * tool — the same reasoning that made the public page's font link
 * non-blocking. Self-hosting also removes the layout shift and the round trip
 * to a domain the visitor never asked to contact.
 *
 * The files are committed rather than fetched by `next/font/google`, which
 * downloads from Google at build time: that turned an offline or air-gapped
 * build into a hard failure, and made every build depend on a third party
 * being up. Two subsets, variable weight, 54 kB total. Rubik is under the SIL
 * Open Font License — see `OFL.txt` beside the files.
 *
 * `variable` exposes it as a CSS custom property so `globals.css` keeps
 * owning the token, rather than a class name being sprinkled through the tree.
 */
const rubik = localFont({
  src: [
    { path: "./fonts/rubik-latin.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/rubik-latin-ext.woff2", weight: "300 900", style: "normal" },
  ],
  display: "swap",
  variable: "--font-rubik",
  // Metric-matched fallback, so the first paint in the system face occupies
  // the same space the webfont will.
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: { default: "Sesame", template: "%s · Sesame" },
  description:
    "Une seule page pour tous vos liens. Créez votre page link-in-bio en quelques minutes.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Sesame" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E0E12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={rubik.variable}>
      <body className="min-h-dvh bg-[#0B0B0F] text-ink-100 antialiased">{children}</body>
    </html>
  );
}
