import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { Panel } from "@/components/ui/Panel";

/**
 * The frame around signing in and signing up.
 *
 * These two screens were a bare form centred on black — no mark, no plane,
 * nothing tying them to the product someone had just clicked through from.
 * They are also the first thing a returning user sees, so they get the same
 * surface treatment as everything else, and the wordmark links home so a
 * visitor who arrived by accident is not stuck.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      {/* Matches the hero's glow, at a fraction of the strength — enough to
          keep the page from reading as a void, quiet enough not to compete
          with the form. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(124,107,245,0.10),transparent_70%)]"
      />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex text-ink-100 transition-colors hover:text-ink-50"
        >
          <Logo />
        </Link>

        <Panel className="p-6">
          <h1 className="text-xl font-semibold tracking-tight text-ink-50">{title}</h1>
          <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
          {children}
        </Panel>

        <p className="mt-5 text-center text-sm text-ink-400">{footer}</p>
      </div>
    </div>
  );
}
