"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Modal focus management: trap Tab inside the dialog, and put focus back where
 * it came from when the dialog closes.
 *
 * Both halves matter, and the restore half is the one usually forgotten. A
 * keyboard user who opens a dialog from the fifth link on a page and closes it
 * should be back on that fifth link — not at the top of the document, having
 * lost their place and any idea of what just happened.
 *
 * Returns a ref to attach to the dialog's container element.
 */
export function useDialogFocus<T extends HTMLElement>(onClose?: () => void) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Narrowed once here so the closures below do not each have to re-check.
    const dialog: T = container;

    // Captured before we move focus, so it survives the dialog's lifetime.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus in, so the next Tab starts inside rather than behind.
    const first = focusables()[0];
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusables();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstEl = elements[0]!;
      const lastEl = elements[elements.length - 1]!;
      const active = document.activeElement;

      // Wrap at both ends rather than letting focus escape to the page behind.
      if (event.shiftKey && (active === firstEl || !dialog.contains(active))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // `isConnected` guards the case where the trigger itself was removed
      // from the DOM while the dialog was open.
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  return containerRef;
}
