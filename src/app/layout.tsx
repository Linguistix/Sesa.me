import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

/**
 * The interface typeface.
 *
 * Loaded through `next/font`, which downloads the files at build time and
 * serves them from our own origin. That matters here for the same reason the
 * public page's font link is non-blocking: a webfont fetched from a third
 * party at runtime is a request that can stall, and this one would stall the
 * whole tool. Self-hosting also removes the layout shift — the metrics are
 * known before the first paint — and the round trip to a domain the visitor
 * never asked to contact.
 *
 * `variable` exposes it as a CSS custom property so `globals.css` keeps
 * owning the token, rather than a class name being sprinkled through the tree.
 */
const rubik = Rubik({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rubik",
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
