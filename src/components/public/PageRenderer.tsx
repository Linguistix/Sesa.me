import Link from "next/link";
import type { CSSProperties } from "react";
import type { Theme } from "@/lib/theme/schema";
import { themeToCssVars } from "@/lib/theme/render";
import { LinkButton } from "./LinkButton";
import { EmbedBlock } from "./EmbedBlock";
import { GalleryBlock } from "./GalleryBlock";
import { FormBlock } from "./FormBlock";
import { ImageBlock } from "./ImageBlock";
import { translator } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";
import type { FormField } from "@/lib/forms";
import type { BlockType } from "@/lib/block-types";

export interface RenderableLink {
  id: string;
  type: BlockType;
  title: string;
  url: string | null;
  emoji: string | null;
  iconUrl: string | null;
  body: string | null;
  images: string[];
  isLocked: boolean;
  /** Present only for FORM blocks. */
  form?: { id: string; fields: FormField[] } | null;
}

export interface RenderablePage {
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: Theme;
  links: RenderableLink[];
  showBranding: boolean;
  locale: Locale;
  /** Pro accounts get a verified badge beside their name. */
  isVerified?: boolean;
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
  const t = translator(page.locale);
  const alignment = page.theme.layout === "left" ? "items-start text-left" : "items-center text-center";

  return (
    <div
      style={vars}
      data-sesame-root=""
      className={[
        // `relative` is load-bearing: it is the containing block for the
        // background layer below.
        "relative flex min-h-full w-full flex-col bg-[var(--sesame-bg)] text-[var(--sesame-text)]",
        preview ? "min-h-full" : "min-h-dvh",
      ].join(" ")}
    >
      {/*
        Absolute, not fixed. A fixed layer is positioned against the viewport,
        so inside the dashboard's phone preview it escaped the frame and
        painted the theme's gradient over the entire editor. Absolute keeps it
        inside this renderer wherever the renderer is mounted — and on the real
        public page it also scrolls with the content, which is what a
        top-anchored radial gradient should do.
      */}
      <div
        aria-hidden
        data-sesame-backdrop=""
        className="pointer-events-none absolute inset-0"
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
            className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight"
            style={{
              fontFamily: "var(--sesame-font-display)",
              fontWeight: "var(--sesame-weight)" as CSSProperties["fontWeight"],
            }}
          >
            {page.displayName}
            {page.isVerified ? <VerifiedBadge label={t("page.verified")} /> : null}
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

        {/*
          Rhythm, not a uniform gap.

          A heading belongs to the blocks under it, so it sits close to them and
          further from what came before. With one gap for everything, a page of
          three sections reads as nine unrelated rows — the grouping the creator
          built is invisible.
        */}
        <nav
          aria-label={`Liens de ${page.displayName}`}
          className={
            page.theme.layout === "grid"
              ? "mt-6 grid w-full grid-cols-2 gap-2.5"
              : "mt-6 flex w-full flex-col gap-2.5"
          }
        >
          {page.links.map((link, index) => (
            <div
              key={link.id}
              className={spacingFor(link, page.links[index - 1], index)}
              style={page.theme.layout === "grid" && isFullWidth(link) ? { gridColumn: "1 / -1" } : undefined}
            >
              <LinkBlock link={link} theme={page.theme} locale={page.locale} />
            </div>
          ))}
        </nav>

        {page.links.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--sesame-muted)]">
            {t("page.noLinks")}
          </p>
        ) : null}

        {page.showBranding ? (
          <footer className="mt-auto pt-10">
            <Link
              href="/"
              // No prefetch: every creator page would otherwise pull the
              // marketing page down on mobile for a link almost nobody taps.
              prefetch={false}
              className="text-xs text-[var(--sesame-muted)] underline-offset-4 hover:underline"
            >
              {t("page.poweredBy")}
            </Link>
          </footer>
        ) : null}
      </main>
    </div>
  );
}

/**
 * Extra space above a block, expressed as a class rather than a margin on the
 * block itself so the rule lives in one place.
 */
function spacingFor(
  link: RenderableLink,
  previous: RenderableLink | undefined,
  index: number,
): string {
  // A heading opens a section: push it away from the previous group, unless it
  // is the very first thing on the page.
  if (link.type === "HEADING" && index > 0) return "pt-5";

  // Text sitting under its heading or button stays close; text following
  // another text block gets a little air.
  if (link.type === "TEXT" && previous?.type === "TEXT") return "pt-1.5";

  // Media is a different kind of object from a row of buttons.
  if (link.type === "GALLERY" || link.type === "EMBED" || link.type === "FORM") {
    return index > 0 ? "pt-2" : "";
  }

  return "";
}

/** Blocks that should span both columns in the grid layout. */
function isFullWidth(link: RenderableLink): boolean {
  return (
    link.type === "HEADING" ||
    link.type === "TEXT" ||
    link.type === "FORM" ||
    link.type === "GALLERY" ||
    link.type === "EMBED"
  );
}

function LinkBlock({
  link,
  theme,
  locale,
}: {
  link: RenderableLink;
  theme: Theme;
  locale: Locale;
}) {

  if (link.type === "HEADING") {
    return (
      <h2
        className="w-full text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sesame-muted)]"
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

  if (link.type === "EMBED") {
    return <EmbedBlock url={link.url ?? ""} title={link.title} />;
  }

  if (link.type === "GALLERY") {
    return <GalleryBlock images={link.images} title={link.title} locale={locale} />;
  }

  if (link.type === "IMAGE") {
    return (
      <ImageBlock
        src={link.images[0] ?? ""}
        title={link.title}
        href={link.url}
        linkId={link.id}
      />
    );
  }

  if (link.type === "FORM") {
    if (!link.form) return null;
    return (
      <FormBlock
        formId={link.form.id}
        title={link.title}
        fields={link.form.fields}
        locale={locale}
      />
    );
  }

  return <LinkButton link={link} shadow={theme.button_style.shadow} locale={locale} />;
}

/**
 * The verified badge.
 *
 * Inline SVG rather than an emoji: the emoji renders differently on every
 * platform and reads as decoration to a screen reader, whereas this carries a
 * real accessible name.
 */
function VerifiedBadge({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className="h-5 w-5 shrink-0"
      style={{ color: "var(--sesame-accent)" }}
    >
      <path
        fill="currentColor"
        d="M12 1.5l2.6 2.1 3.3-.3.9 3.2 2.7 2-1.4 3 1.4 3-2.7 2-.9 3.2-3.3-.3L12 22.5l-2.6-2.1-3.3.3-.9-3.2-2.7-2 1.4-3-1.4-3 2.7-2 .9-3.2 3.3.3L12 1.5z"
      />
      <path
        fill="var(--sesame-bg)"
        d="M10.8 15.3l-3-3 1.2-1.2 1.8 1.8 4.2-4.2 1.2 1.2-5.4 5.4z"
      />
    </svg>
  );
}
