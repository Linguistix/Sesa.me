import Link from "next/link";
import { headers } from "next/headers";
import { THEME_PRESETS, findPreset } from "@/lib/theme/presets";
import { ALLOWED_FONTS } from "@/lib/theme/schema";
import { PLAN_LIMITS } from "@/lib/plans";
import { slugForHostname } from "@/server/domains";
import { baseUrl } from "@/lib/urls";
import { PublicPageView } from "@/components/public/PublicPageView";
import { ThemeCard } from "@/components/marketing/ThemeCard";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

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

const SHOWCASE = [
  { id: "gold-noir", displayName: "Camille", role: "Productrice & DJ", lines: ["Nouveau single", "Dates de tournée"] },
  { id: "ivory", displayName: "Studio Faune", role: "Céramique", lines: ["La boutique", "Nos ateliers"] },
  { id: "neon", displayName: "KAVI", role: "Producteur", lines: ["Écouter", "Twitch"] },
  { id: "forest", displayName: "Léa Marchand", role: "Coach", lines: ["Réserver un appel", "Newsletter"] },
] as const;

const FEATURES = [
  {
    title: "Un design, pas un gabarit",
    body: "Douze thèmes de départ, puis chaque couleur, police et forme de bouton se règle. Ou décrivez ce que vous voulez et laissez l'IA composer la palette.",
  },
  {
    title: "Plus que des liens",
    body: "Lecteurs Spotify et YouTube intégrés, galerie photo, formulaire de contact, liens protégés par mot de passe. La page fait le travail, pas seulement la redirection.",
  },
  {
    title: "Vous savez ce qui marche",
    body: "Vues, clics, sources et pays — mesurés sans cookie ni adresse IP conservée. Vos statistiques ne coûtent pas la vie privée de vos visiteurs.",
  },
  {
    title: "Ouvre la vraie application",
    body: "Un lien vers Spotify ouvre Spotify, pas un navigateur coincé dans Instagram. Le raccourcisseur gère le passage à l'app native.",
  },
] as const;

function LandingPage() {
  const showcase = SHOWCASE.map((entry) => ({
    ...entry,
    theme: findPreset(entry.id)!.theme,
  }));

  return (
    <div className="app-scope min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 px-5 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between">
          <Logo />

          <nav className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-base text-ink-300 transition-colors hover:bg-white/6 hover:text-ink-50"
            >
              Connexion
            </Link>
            <ButtonLink href="/signup" variant="primary">
              Commencer
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        {/* --- Hero ------------------------------------------------------- */}
        <section className="relative overflow-hidden px-5 pb-20 pt-20 sm:pt-28">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
            style={{
              background:
                "radial-gradient(closest-side, var(--color-accent-400), transparent)",
            }}
          />

          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-ink-300 ring-1 ring-inset ring-white/10">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              {ALLOWED_FONTS.length} polices · {THEME_PRESETS.length} thèmes · design par IA
            </p>

            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Tous vos liens,
              <br />
              <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent">
                une seule adresse.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-pretty text-md text-ink-300">
              La page qui vit dans votre bio Instagram, TikTok ou YouTube. Vos liens, votre
              musique, votre boutique — et un design qui vous ressemble vraiment.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" variant="primary" size="lg">
                Créer ma page gratuitement
              </ButtonLink>
              <ButtonLink href="/camille" variant="secondary" size="lg">
                Voir un exemple
              </ButtonLink>
            </div>

            <p className="mt-4 text-xs text-ink-500">
              Gratuit, sans carte bancaire. {PLAN_LIMITS.FREE.aiGenerationsPerMonth} générations
              IA par mois incluses.
            </p>
          </div>

          {/* The product, immediately. Four real themes rendered from the
              same objects the app ships. */}
          <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
            {showcase.map((entry) => (
              <li key={entry.id}>
                <ThemeCard
                  theme={entry.theme}
                  name={entry.role}
                  displayName={entry.displayName}
                  lines={[...entry.lines]}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* --- Features --------------------------------------------------- */}
        <section className="border-t border-white/8 px-5 py-20" aria-labelledby="features-heading">
          <div className="mx-auto max-w-5xl">
            <h2 id="features-heading" className="max-w-lg text-2xl font-semibold tracking-tight">
              Une page qui travaille pour vous.
            </h2>

            <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {FEATURES.map((feature, index) => (
                <div key={feature.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 tabular text-sm text-ink-600"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-md font-medium text-ink-50">{feature.title}</h3>
                    <p className="mt-1.5 text-base text-ink-400">{feature.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- Accessibility, as a differentiator ------------------------- */}
        <section className="border-t border-white/8 px-5 py-20" aria-labelledby="a11y-heading">
          <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <h2 id="a11y-heading" className="text-2xl font-semibold tracking-tight">
                Lisible par tout le monde, sans y penser.
              </h2>
              <p className="mt-4 text-base text-ink-400">
                Chaque thème — préconçu ou généré — est vérifié contre le contraste WCAG AA avant
                d&apos;être appliqué. Si une couleur passe sous le seuil, elle est ajustée
                automatiquement en conservant sa teinte : votre doré reste doré, simplement
                lisible.
              </p>
              <p className="mt-3 text-base text-ink-400">
                Navigation au clavier complète, y compris le réordonnancement des blocs.
              </p>
            </div>

            <div className="rounded-xl bg-ink-880 p-5 ring-1 ring-inset ring-white/7">
              <p className="text-xs font-medium text-ink-300">Correction automatique</p>
              <dl className="mt-4 space-y-3 text-xs">
                {[
                  { pair: "Texte sur fond", before: "#E8D9A8", after: "#8A7433", from: "1.9", to: "4.7" },
                  { pair: "Accent sur fond", before: "#F0E4B8", after: "#9A8340", from: "1.4", to: "3.6" },
                ].map((row) => (
                  <div key={row.pair} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-ink-400">{row.pair}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-4 w-4 rounded"
                        style={{ background: row.before }}
                      />
                      <span className="tabular text-critical-400">{row.from}:1</span>
                    </span>
                    <span aria-hidden className="text-ink-600">
                      →
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-4 w-4 rounded"
                        style={{ background: row.after }}
                      />
                      <span className="tabular text-positive-400">{row.to}:1</span>
                    </span>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* --- Plans ------------------------------------------------------ */}
        <section className="border-t border-white/8 px-5 py-20" aria-labelledby="plans-heading">
          <div className="mx-auto max-w-5xl">
            <h2 id="plans-heading" className="text-2xl font-semibold tracking-tight">
              Deux plans, c&apos;est tout.
            </h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <PlanCard
                name="Gratuit"
                price="0 €"
                caption="Pour commencer"
                features={[
                  "Page publique et blocs illimités",
                  `${THEME_PRESETS.length} thèmes et QR code`,
                  `${PLAN_LIMITS.FREE.aiGenerationsPerMonth} générations IA par mois`,
                  `Statistiques sur ${PLAN_LIMITS.FREE.analyticsRetentionDays} jours`,
                ]}
                cta={{ href: "/signup", label: "Créer ma page" }}
              />
              <PlanCard
                highlighted
                name="Pro"
                price="7 €"
                caption="par mois"
                features={[
                  "Sans mention Sesame",
                  "Domaine personnalisé",
                  "Générations IA illimitées",
                  `Statistiques sur ${PLAN_LIMITS.PRO.analyticsRetentionDays} jours + export CSV`,
                  "Badge vérifié et avatar animé",
                ]}
                cta={{ href: "/signup", label: "Essayer Pro" }}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 px-5 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
          <span>Sesame — plateforme link-in-bio.</span>
          <Link href="/login" className="transition-colors hover:text-ink-200">
            Connexion
          </Link>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({
  name,
  price,
  caption,
  features,
  cta,
  highlighted = false,
}: {
  name: string;
  price: string;
  caption: string;
  features: string[];
  cta: { href: string; label: string };
  highlighted?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col rounded-xl p-6 ring-1 ring-inset",
        highlighted
          ? "bg-accent-500/[0.07] ring-accent-400/30"
          : "bg-ink-880 ring-white/7",
      ].join(" ")}
    >
      <h3 className="text-base font-medium text-ink-100">{name}</h3>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight">{price}</span>
        <span className="text-xs text-ink-500">{caption}</span>
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-base text-ink-300">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <svg viewBox="0 0 12 12" aria-hidden className="mt-1 h-3 w-3 shrink-0 text-accent-400">
              <path d="m2.5 6.5 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <ButtonLink
        href={cta.href}
        variant={highlighted ? "primary" : "secondary"}
        size="lg"
        className="mt-6 w-full"
      >
        {cta.label}
      </ButtonLink>
    </div>
  );
}
