import type { ReactNode } from "react";

/**
 * The live preview, presented as a device on a stage.
 *
 * This is the only saturated thing on the screen — it is the creator's own
 * page — so the chrome around it stays neutral and the frame does the work of
 * saying "this is the real thing, at real size". The glow behind it is pulled
 * from the page's own accent, which makes each theme feel present in the room
 * rather than pasted into a slot.
 */
export function PhonePreview({
  children,
  href,
  label = "Aperçu",
}: {
  children: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Ambient light from the previewed theme's own accent. */}
        <div
          aria-hidden
          className="absolute -inset-8 -z-10 rounded-[3rem] opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 30%, var(--sesame-accent, #7c6bf5), transparent 70%)",
          }}
        />

        {/*
          On a phone the frame is a window onto the page rather than a whole
          device: full height would fill the screen and leave no room for the
          controls it is supposed to be previewing. The width is unchanged so
          the page inside still lays out at its real measure — only how much of
          it you see at once changes.
        */}
        <div className="relative h-[34vh] max-h-[652px] w-[322px] rounded-[2.5rem] bg-ink-800 p-[3px] shadow-float ring-1 ring-inset ring-white/12 lg:h-[652px]">
          <div className="relative h-full w-full overflow-hidden rounded-[2.35rem] bg-ink-950">
            {/* Status-bar notch, so the frame reads as a phone at a glance. */}
            <div
              aria-hidden
              className="absolute left-1/2 top-2 z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black/85"
            />
            <div className="h-full w-full overflow-y-auto overscroll-contain">{children}</div>
          </div>
        </div>
      </div>

      <figcaption className="flex items-center gap-3 text-xs">
        <span className="text-ink-500">{label}</span>
        {href ? (
          <>
            <span aria-hidden className="h-3 w-px bg-white/10" />
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-ink-300 transition-colors hover:bg-white/6 hover:text-ink-50"
            >
              Ouvrir la vraie page
              <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3">
                <path d="M4 2h6v6M10 2 4.5 7.5M8 9.5v.5H2V4h.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
