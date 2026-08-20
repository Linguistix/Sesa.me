import Link from "next/link";
import { headers } from "next/headers";
import { THEME_PRESETS } from "@/lib/theme/presets";
import { slugForHostname } from "@/server/domains";
import { baseUrl } from "@/lib/urls";
import { PublicPageView } from "@/components/public/PublicPageView";

/**
 * The root route serves two things.
 *
 * Under the app's own domain it is the marketing page. Under a *verified*
 * custom domain it is that domain's page — resolving here rather than in
 * middleware keeps the lookup in the Node runtime, where Prisma runs.
 *
 * Unverified domains deliberately fall through to the landing page: serving a
 * page from a hostname nobody proved they own is exactly what verification
 * exists to prevent.
 */
export default async function RootRoute() {
  const host = (await headers()).get("host");
  const ownHost = safeHost(baseUrl());

  if (host && host !== ownHost) {
    const slug = await slugForHostname(host.split(":")[0]!);
    if (slug) return <PublicPageView slug={slug} />;
  }

  return <LandingPage />;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function LandingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5">
      <header className="flex h-16 items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Sesame</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-1.5 text-neutral-400 hover:text-neutral-100">
            Connexion
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-500 px-3 py-1.5 font-medium text-white transition hover:bg-indigo-400"
          >
            Commencer
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Tous vos liens, une seule adresse.
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-neutral-400">
          Créez la page qui vit dans votre bio Instagram, TikTok ou YouTube. Vos liens, votre
          musique, votre boutique — et un design à votre image en quelques secondes.
        </p>

        <Link
          href="/signup"
          className="mt-8 rounded-xl bg-indigo-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Créer ma page gratuitement
        </Link>

        <ul className="mt-16 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_PRESETS.slice(0, 4).map((preset) => (
            <li
              key={preset.id}
              className="overflow-hidden rounded-xl border border-white/10"
              style={{ background: preset.theme.palette.background }}
            >
              <div className="flex flex-col items-center gap-2 p-4">
                <span
                  aria-hidden
                  className="h-8 w-8 rounded-full"
                  style={{ background: preset.theme.palette.accent }}
                />
                <span
                  className="h-2 w-16 rounded-full"
                  style={{ background: preset.theme.palette.text_primary, opacity: 0.85 }}
                />
                <span
                  aria-hidden
                  className="mt-1 h-6 w-full rounded-md"
                  style={{ background: preset.theme.palette.surface }}
                />
                <span
                  aria-hidden
                  className="h-6 w-full rounded-md"
                  style={{ background: preset.theme.palette.surface }}
                />
                <span className="mt-1 text-[11px]" style={{ color: preset.theme.palette.text_muted }}>
                  {preset.name}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-neutral-600">
        Sesame — plateforme link-in-bio.
      </footer>
    </div>
  );
}
