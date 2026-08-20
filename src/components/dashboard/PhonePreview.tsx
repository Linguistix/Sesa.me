import type { ReactNode } from "react";

/** A phone-shaped frame for the live preview — mobile is where these pages are seen. */
export function PhonePreview({ children, href }: { children: ReactNode; href?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[640px] w-[320px] shrink-0 overflow-hidden rounded-[2.25rem] border-[10px] border-neutral-800 bg-black shadow-2xl">
        <div
          aria-hidden
          className="absolute left-1/2 top-0 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-800"
        />
        <div className="h-full w-full overflow-y-auto overscroll-contain">{children}</div>
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-300 hover:underline"
        >
          Ouvrir la vraie page ↗
        </a>
      ) : null}
    </div>
  );
}
