import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="min-h-dvh bg-[#0B0B0F]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0B0F]/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Sesame
          </Link>

          <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
            <NavLink href="/dashboard">Éditeur</NavLink>
            <NavLink href="/dashboard/appearance">Apparence</NavLink>
            <NavLink href="/dashboard/share">Partager</NavLink>
          </nav>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-100"
    >
      {children}
    </Link>
  );
}
