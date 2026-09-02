"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The dashboard's navigation.
 *
 * Nine items in one flat row gave every screen equal weight and no indication
 * of where you were. They are not equal: three are the daily loop (build the
 * page, style it, share it), two are what you check, and the rest are
 * settings you visit rarely. The grouping reflects that, and settings move
 * behind a menu so the bar stops competing with the page.
 */
const PRIMARY = [
  { href: "/dashboard", label: "Éditeur" },
  { href: "/dashboard/appearance", label: "Apparence" },
  { href: "/dashboard/share", label: "Partager" },
] as const;

const SECONDARY = [
  { href: "/dashboard/analytics", label: "Statistiques" },
  { href: "/dashboard/submissions", label: "Réponses" },
] as const;

export const SETTINGS_LINKS = [
  { href: "/dashboard/connections", label: "Comptes connectés" },
  { href: "/dashboard/domain", label: "Domaine" },
  { href: "/dashboard/billing", label: "Abonnement" },
  { href: "/dashboard/settings", label: "Réglages" },
] as const;

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="flex items-center gap-0.5">
      {[...PRIMARY, ...SECONDARY].map((item, index) => (
        <span key={item.href} className="flex shrink-0 items-center">
          {index === PRIMARY.length ? (
            <span aria-hidden className="mx-1.5 h-4 w-px bg-white/10 md:mx-2" />
          ) : null}
          <NavTab href={item.href} label={item.label} pathname={pathname} />
        </span>
      ))}
    </nav>
  );
}

function NavTab({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  // `/dashboard` would otherwise match every child route.
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-base transition-colors duration-[120ms] md:px-3",
        active ? "text-ink-50" : "text-ink-400 hover:bg-white/5 hover:text-ink-100",
      ].join(" ")}
    >
      {label}
      {active ? (
        <span
          aria-hidden
          className="absolute inset-x-2.5 -bottom-1 h-px bg-accent-400 md:inset-x-3 md:-bottom-[13px]"
        />
      ) : null}
    </Link>
  );
}

/** Settings, as a disclosure rather than four more tabs. */
export function SettingsMenu({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const active = SETTINGS_LINKS.some((link) => pathname.startsWith(link.href));

  return (
    <details className="group relative">
      <summary
        className={[
          "flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 text-base",
          "transition-colors duration-[120ms] [&::-webkit-details-marker]:hidden",
          active ? "text-ink-50" : "text-ink-400 hover:bg-white/5 hover:text-ink-100",
        ].join(" ")}
      >
        Réglages
        <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 transition-transform group-open:rotate-180">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg bg-ink-850 p-1 shadow-float ring-1 ring-inset ring-white/10">
        {SETTINGS_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname.startsWith(link.href) ? "page" : undefined}
            className={[
              "block rounded-md px-2.5 py-2 text-base transition-colors duration-[120ms]",
              pathname.startsWith(link.href)
                ? "bg-white/6 text-ink-50"
                : "text-ink-300 hover:bg-white/5 hover:text-ink-50",
            ].join(" ")}
          >
            {link.label}
          </Link>
        ))}
        {children ? <div className="mt-1 border-t border-white/8 pt-1">{children}</div> : null}
      </div>
    </details>
  );
}
