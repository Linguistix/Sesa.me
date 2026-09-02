"use client";

import { useState } from "react";
import type { RenderableLink } from "./PageRenderer";
import { translator } from "@/lib/i18n/messages";
import { faviconUrl } from "@/lib/favicon";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { Locale } from "@/lib/i18n/config";

/**
 * A single link block.
 *
 * Unlocked links are a plain anchor — no JS needed to follow them, which
 * matters because this is the one thing every visitor came to do. The client
 * component only earns its keep for password-gated links, where the
 * destination has to stay server-side until the password checks out.
 */
export function LinkButton({
  link,
  shadow,
  locale,
}: {
  link: RenderableLink;
  shadow: boolean;
  // The locale crosses the server/client boundary, not the translator —
  // functions are not serializable in a React Server Components payload.
  locale: Locale;
}) {
  const t = translator(locale);
  const [unlocking, setUnlocking] = useState(false);

  const className = [
    "flex w-full items-center gap-3 px-5 py-4 text-[15px] font-medium",
    "transition-transform duration-150 will-change-transform",
    "hover:-translate-y-0.5 active:translate-y-0",
    "focus-visible:outline-2 focus-visible:outline-offset-2",
  ].join(" ");

  const style = {
    background: "var(--sesame-btn-bg)",
    color: "var(--sesame-btn-text)",
    border: "var(--sesame-btn-border)",
    borderRadius: "var(--sesame-radius)",
    boxShadow: shadow ? "var(--sesame-btn-shadow)" : undefined,
    backdropFilter: "var(--sesame-btn-backdrop)",
    fontFamily: "var(--sesame-font-body)",
    outlineColor: "var(--sesame-btn-text)",
  } as const;

  // Emoji wins, then an explicit icon, then the destination's own favicon.
  const iconSrc = link.emoji ? null : (link.iconUrl ?? faviconUrl(link.url));

  const label = (
    <>
      {link.emoji ? (
        <span aria-hidden className="text-lg leading-none">
          {link.emoji}
        </span>
      ) : iconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconSrc}
          alt=""
          aria-hidden
          width={18}
          height={18}
          loading="lazy"
          decoding="async"
          className="h-[18px] w-[18px] shrink-0 rounded-sm"
          // Plenty of sites have no /favicon.ico; a broken-image glyph would
          // look worse than no icon at all.
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span className="flex-1 text-center">{link.title}</span>
      {link.isLocked ? (
        <svg viewBox="0 0 12 12" aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60">
          <path
            d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5M2.5 5h7v5h-7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </>
  );

  if (!link.isLocked) {
    return (
      <a
        href={link.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        data-link-id={link.id}
      >
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setUnlocking(true)}
        className={className}
        style={style}
        aria-haspopup="dialog"
        aria-label={`${link.title} — ${t("page.locked")}`}
        data-link-id={link.id}
      >
        {label}
      </button>
      {unlocking ? (
        <UnlockDialog link={link} locale={locale} onClose={() => setUnlocking(false)} />
      ) : null}
    </>
  );
}

function UnlockDialog({
  link,
  locale,
  onClose,
}: {
  link: RenderableLink;
  locale: Locale;
  onClose: () => void;
}) {
  const t = translator(locale);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch(`/api/links/${link.id}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setPending(false);

    if (!response.ok) {
      setError(t("unlock.wrong"));
      return;
    }

    const { url } = (await response.json()) as { url: string };
    window.location.assign(url);
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${link.title} — ${t("page.locked")}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-[var(--sesame-surface)] p-6 text-left"
      >
        <h2 className="text-base font-semibold text-[var(--sesame-text)]">{link.title}</h2>
        <p className="mt-1 text-sm text-[var(--sesame-muted)]">
          {t("unlock.title")}
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-[var(--sesame-text)] outline-none focus:border-[var(--sesame-accent)]"
          placeholder={t("unlock.placeholder")}
          aria-invalid={error !== null}
          aria-describedby={error ? `unlock-error-${link.id}` : undefined}
        />

        {error ? (
          <p id={`unlock-error-${link.id}`} role="alert" className="mt-2 text-sm text-[var(--sesame-critical)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm text-[var(--sesame-muted)]"
          >
            {t("unlock.cancel")}
          </button>
          <button
            type="submit"
            disabled={pending || password.length === 0}
            className="flex-1 rounded-lg bg-[var(--sesame-accent)] px-4 py-2 text-sm font-medium text-[var(--sesame-btn-text)] disabled:opacity-50"
          >
            {pending ? t("unlock.checking") : t("unlock.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
