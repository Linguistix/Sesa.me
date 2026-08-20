"use client";

import { useCallback, useEffect, useState } from "react";
import { translator } from "@/lib/i18n/messages";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { Locale } from "@/lib/i18n/config";

/**
 * Photo grid with a full-screen lightbox.
 *
 * Keyboard support is not decoration: a lightbox that traps focus with no way
 * out is worse than no lightbox. Escape closes, arrows navigate, and focus
 * returns to the thumbnail that opened it.
 */
export function GalleryBlock({
  images,
  title,
  locale,
}: {
  images: string[];
  title: string;
  locale: Locale;
}) {
  const t = translator(locale);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(() => setOpenIndex(null));

  const close = useCallback(() => setOpenIndex(null), []);
  const previous = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length],
  );
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    // Escape and Tab are handled by useDialogFocus; only navigation here.
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") previous();
      else if (event.key === "ArrowRight") next();
    }

    document.addEventListener("keydown", onKey);
    // Stop the page behind the lightbox from scrolling under it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, previous, next]);

  if (images.length === 0) return null;

  return (
    <div className="w-full">
      <ul className="grid grid-cols-3 gap-2">
        {images.map((src, index) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="block w-full overflow-hidden"
              style={{ borderRadius: "var(--sesame-radius)" }}
              aria-label={`${t("gallery.open")} ${index + 1}/${images.length}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${title} — ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover transition-transform duration-200 hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[openIndex]}
            alt={`${title} — ${openIndex + 1}`}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            onClick={close}
            aria-label={t("gallery.close")}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur"
          >
            ✕
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  previous();
                }}
                aria-label={t("gallery.previous")}
                className="absolute left-3 rounded-full bg-white/10 px-3 py-2 text-white backdrop-blur"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label={t("gallery.next")}
                className="absolute right-3 rounded-full bg-white/10 px-3 py-2 text-white backdrop-blur"
              >
                ›
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
