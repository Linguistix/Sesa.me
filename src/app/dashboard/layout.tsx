import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { signOutAction } from "@/actions/auth";
import { NavTabs, SettingsMenu } from "@/components/dashboard/Nav";
import { Logo } from "@/components/ui/Logo";
import { appUrl, displayHost } from "@/lib/urls";
import { Badge } from "@/components/ui/Panel";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [page, user] = await Promise.all([
    getEditablePage(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, email: true },
    }),
  ]);

  return (
    <div className="app-scope min-h-dvh bg-ink-950">
      {/*
        A single sticky bar, two rows: identity and navigation above, the
        creator's own URL below. The URL is the one piece of state a creator
        checks constantly — it is what they paste everywhere — so it earns a
        permanent place rather than living only on the Share screen.
      */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-md font-semibold tracking-tight text-ink-50"
          >
            <Logo />
          </Link>

          <div className="hidden flex-1 md:block">
            <NavTabs />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {user?.plan === "PRO" ? <Badge tone="accent">Pro</Badge> : null}

            <SettingsMenu>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="block w-full rounded-md px-2.5 py-2 text-left text-base text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-100"
                >
                  Déconnexion
                </button>
              </form>
            </SettingsMenu>
          </div>
        </div>

        {page ? (
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 pb-2.5 md:hidden">
            <NavTabs />
          </div>
        ) : null}

        {page ? (
          <div className="border-t border-white/6 bg-ink-900/60">
            <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-2 text-xs">
              <span className="text-ink-500">Votre page</span>
              <a
                href={appUrl(`/${page.slug}`)}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-ink-200 transition-colors hover:bg-white/6 hover:text-ink-50"
              >
                <span className="text-ink-500">{displayHost()}/</span>
                <span className="font-medium">{page.slug}</span>
                <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100">
                  <path d="M4 2h6v6M10 2 4.5 7.5M8 9.5v.5H2V4h.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">Ouvrir dans un nouvel onglet</span>
              </a>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
