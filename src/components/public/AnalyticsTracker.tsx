"use client";

import { useEffect, useState } from "react";
import {
  analyticsAllowed,
  readConsent,
  signalsOptOut,
  writeConsent,
  type ConsentValue,
} from "@/lib/analytics/consent";

/**
 * Records the page view and outbound clicks, subject to consent.
 *
 * Views cannot be counted server-side because the page is served from the ISR
 * cache, so this runs in the browser. Clicks are captured by delegation on the
 * document rather than by wiring a handler onto every link, which keeps the
 * public page's markup free of per-link JavaScript.
 */
export function AnalyticsTracker({ pageId }: { pageId: string }) {
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setResolved(true);
  }, []);

  useEffect(() => {
    if (!resolved || !analyticsAllowed()) return;

    send({ pageId, type: "PAGE_VIEW", referrer: document.referrer || null });

    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-link-id]");
      const linkId = target?.dataset.linkId;
      if (!linkId) return;

      send({ pageId, type: "LINK_CLICK", linkId, referrer: document.referrer || null });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pageId, consent, resolved]);

  // Wait for the stored answer before rendering, so the banner does not flash
  // for visitors who already decided.
  if (!resolved || consent !== null || signalsOptOut()) return null;

  return (
    <ConsentBanner
      onDecide={(value) => {
        writeConsent(value);
        setConsent(value);
      }}
    />
  );
}

function ConsentBanner({ onDecide }: { onDecide: (value: ConsentValue) => void }) {
  return (
    <div
      role="region"
      aria-label="Consentement aux mesures d'audience"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-white/15 bg-neutral-900/95 p-4 text-left shadow-2xl backdrop-blur"
    >
      <p className="text-sm text-neutral-200">
        Nous mesurons les visites de cette page de façon anonyme, sans cookie ni adresse IP
        conservée.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onDecide("granted")}
          className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Accepter
        </button>
        <button
          type="button"
          onClick={() => onDecide("denied")}
          className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/5"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}

interface EventPayload {
  pageId: string;
  type: "PAGE_VIEW" | "LINK_CLICK";
  linkId?: string;
  referrer: string | null;
}

function send(payload: EventPayload) {
  const body = JSON.stringify(payload);

  // sendBeacon survives the page being unloaded by the click it is reporting;
  // fetch with keepalive is the fallback where it is unavailable.
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // A dropped analytics event is not worth surfacing to the visitor.
  });
}
