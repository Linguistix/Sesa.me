import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="fr">
      <body className="min-h-dvh bg-[#0B0B0F] text-ink-100 antialiased">{children}</body>
    </html>
  );
}
