"use client";

import { useMemo, useState } from "react";
import { contrastRatio } from "@/lib/theme/contrast";
import { Panel, SectionHeader, Badge } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

/**
 * QR customisation with a live preview.
 *
 * The preview `img` points at the same endpoint the download buttons use, so
 * what the user sees is byte-for-byte what they get — no separate client-side
 * renderer to drift out of sync.
 */
export function SharePanel({ slug, publicUrl }: { slug: string; publicUrl: string }) {
  const [dark, setDark] = useState("#000000");
  const [light, setLight] = useState("#FFFFFF");
  const [copied, setCopied] = useState(false);

  const qrSrc = useMemo(() => {
    const params = new URLSearchParams({ slug, format: "png", dark, light, size: "512" });
    return `/api/qr?${params}`;
  }, [slug, dark, light]);

  // A QR code is read by thresholding light against dark. The spec asks for a
  // wide margin between the two, and a scanner working from a phone camera in
  // bad light needs more than the eye does — so we warn well before the pair
  // becomes unreadable, rather than letting someone print a poster that no
  // phone can scan.
  const qrRatio = contrastRatio(dark, light);
  const scannability =
    qrRatio >= 7 ? "good" : qrRatio >= 4.5 ? "fair" : "poor";

  function downloadHref(format: "png" | "svg") {
    const params = new URLSearchParams({ slug, format, dark, light, size: "1024" });
    return `/api/qr?${params}`;
  }

  async function copy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-5">
        <Panel className="p-5">
          <SectionHeader
            id="url-heading"
            title="Votre lien public"
            description="C'est l'adresse à coller dans votre bio."
          />

          <div className="flex gap-2">
            <input
              readOnly
              value={publicUrl}
              aria-label="URL publique de votre page"
              onFocus={(e) => e.currentTarget.select()}
              className={`${inputClass} font-mono`}
            />
            <Button type="button" variant="primary" onClick={copy} className="shrink-0">
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>

          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-ink-400 underline-offset-4 transition-colors hover:text-ink-100 hover:underline"
          >
            Ouvrir la page ↗
          </a>
        </Panel>

        <Panel className="p-5">
          <SectionHeader
            title="Couleurs du QR code"
            description="Assortissez-le à votre identité — en gardant un écart suffisant pour qu'il reste lisible par un téléphone."
            action={
              <Badge
                tone={
                  scannability === "good" ? "positive" : scannability === "fair" ? "caution" : "critical"
                }
              >
                {scannability === "good"
                  ? "Lecture facile"
                  : scannability === "fair"
                    ? "Lecture limite"
                    : "Difficile à scanner"}
              </Badge>
            }
          />

          <div className="flex flex-wrap gap-5">
            <ColorField label="Modules" value={dark} onChange={setDark} />
            <ColorField label="Fond" value={light} onChange={setLight} />
          </div>

          <p
            role="status"
            className={`mt-4 text-xs ${scannability === "poor" ? "text-critical-400" : "text-ink-400"}`}
          >
            Contraste modules / fond : <span className="tabular">{qrRatio.toFixed(1)}:1</span>.{" "}
            {scannability === "good"
              ? "Confortable, y compris imprimé en petit."
              : scannability === "fair"
                ? "Correct de près, moins fiable sur un écran ou en faible lumière."
                : "Beaucoup de téléphones échoueront. Foncez les modules ou éclaircissez le fond."}
          </p>
        </Panel>
      </div>

      <Panel className="flex flex-col items-center p-5" aria-labelledby="qr-heading">
        <h2
          id="qr-heading"
          className="mb-4 self-start text-2xs font-medium uppercase tracking-[0.08em] text-ink-500"
        >
          QR code
        </h2>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt={`QR code menant à ${publicUrl}`}
          width={224}
          height={224}
          className="rounded-lg"
          style={{ background: light, padding: 12 }}
        />

        <div className="mt-5 flex w-full gap-2">
          <a
            href={downloadHref("png")}
            download
            className="flex-1 rounded-md px-3 py-1.5 text-center text-xs text-ink-200 ring-1 ring-inset ring-white/12 transition hover:bg-white/5"
          >
            PNG
          </a>
          <a
            href={downloadHref("svg")}
            download
            className="flex-1 rounded-md px-3 py-1.5 text-center text-xs text-ink-200 ring-1 ring-inset ring-white/12 transition hover:bg-white/5"
          >
            SVG
          </a>
        </div>
      </Panel>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-white/12 bg-transparent"
        />
        <span className="tabular text-xs uppercase text-ink-400">{value}</span>
      </span>
    </label>
  );
}
