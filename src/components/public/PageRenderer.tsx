import type { CSSProperties } from "react";
import type { Theme } from "@/lib/theme/schema";
import { themeToCssVars } from "@/lib/theme/render";
import { LinkButton } from "./LinkButton";

export interface RenderableLink {
  id: string;
  type: "LINK" | "HEADING" | "TEXT" | "SOCIAL";
  title: string;
  url: string | null;
  emoji: string | null;
  iconUrl: string | null;
  body: string | null;
  isLocked: boolean;
}

export interface RenderablePage {
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: Theme;
  links: RenderableLink[];
  showBranding: boolean;
}

/**
 * Renders a public page from a validated theme.
 *
 * This is a server component with no client JS of its own — the whole first
 * paint is HTML plus one stylesheet, which is what keeps the page inside the
 * sub-second budget. Interactive bits (locked links) opt in individually.
 */
export function PageRenderer({ page, preview = false }: { page: RenderablePage; preview?: boolean }) {
  const vars = themeToCssVars(page.theme) as CSSProperties;
  const alignment = page.theme.layout === "left" ? "items-start text-left" : "items-center text-center";

  return (
    <div
      style={vars}
      data-sesame-root=""
      className={[
        "flex min-h-full w-full flex-col bg-[var(--sesame-bg)] text-[var(--sesame-text)]",
        preview ? "min-h-full" : "min-h-dvh",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ backgroundImage: "var(--sesame-bg-image)" }}
      />

      <main
        className={`relative z-10 mx-auto flex w-full max-w-[600px] flex-1 flex-col ${alignment} gap-4 px-5 py-12 sm:py-16`}
      >
        <header className={`flex w-full flex-col ${alignment} gap-3`}>
          {page.avatarUrl ? (
            // Not next/image: avatars are arbitrary remote URLs and the
            // optimizer round-trip costs more than it saves at this size.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={page.avatarUrl}
              alt={`Photo de profil de ${page.displayName}`}
              width={96}
              height={96}
              loading="eager"
              decoding="async"
              className="h-24 w-24 object-cover"
              style={{ borderRadius: "var(--sesame-avatar-radius)" }}
            />
          ) : (
            <div
              aria-hidden
              className="flex h-24 w-24 items-center justify-center bg-[var(--sesame-surface)] text-3xl font-semibold"
              style={{ borderRadius: "var(--sesame-avatar-radius)" }}
            >
              {page.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{
              fontFamily: "var(--sesame-font-display)",
              fontWeight: "var(--sesame-weight)" as CSSProperties["fontWeight"],
            }}
          >
            {page.displayName}
          </h1>

          {page.bio ? (
            <p
              className="max-w-[46ch] text-sm leading-relaxed text-[var(--sesame-muted)]"
              style={{ fontFamily: "var(--sesame-font-body)" }}
            >
              {page.bio}
            </p>
          ) : null}
        </header>

        <nav
          aria-label={`Liens de ${page.displayName}`}
          className={
            page.theme.layout === "grid"
              ? "mt-4 grid w-full grid-cols-2 gap-3"
              : "mt-4 flex w-full flex-col gap-3"
          }
        >
          {page.links.map((link) => (
            <LinkBlock key={link.id} link={link} theme={page.theme} />
          ))}
        </nav>

        {page.links.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--sesame-muted)]">
            Cette page n&apos;a pas encore de liens.
          </p>
        ) : null}

        {page.showBranding ? (
          <footer className="mt-auto pt-10">
            <a
              href="/"
              className="text-xs text-[var(--sesame-muted)] underline-offset-4 hover:underline"
            >
              Propulsé par Sesame
            </a>
          </footer>
        ) : null}
      </main>
    </div>
  );
}

function LinkBlock({ link, theme }: { link: RenderableLink; theme: Theme }) {
  if (link.type === "HEADING") {
    return (
      <h2
        className="mt-4 w-full text-sm font-semibold uppercase tracking-widest text-[var(--sesame-muted)]"
        style={{ fontFamily: "var(--sesame-font-display)" }}
      >
        {link.title}
      </h2>
    );
  }

  if (link.type === "TEXT") {
    return (
      <p
        className="w-full whitespace-pre-line text-sm leading-relaxed text-[var(--sesame-muted)]"
        style={{ fontFamily: "var(--sesame-font-body)" }}
      >
        {link.body || link.title}
      </p>
    );
  }

  return <LinkButton link={link} shadow={theme.button_style.shadow} />;
}
