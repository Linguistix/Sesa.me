"use client";

import { useMemo, useState } from "react";

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
    <div className="grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="url-heading" className="flex flex-col gap-4">
        <h2 id="url-heading" className="text-sm font-medium text-neutral-400">
          Votre lien public
        </h2>

        <div className="flex gap-2">
          <input
            readOnly
            value={publicUrl}
            aria-label="URL publique de votre page"
            className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-neutral-100 outline-none"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>

        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
        >
          Ouvrir la page ↗
        </a>

        <h2 className="mt-4 text-sm font-medium text-neutral-400">Couleurs du QR code</h2>
        <div className="flex gap-4">
          <ColorField label="Modules" value={dark} onChange={setDark} />
          <ColorField label="Fond" value={light} onChange={setLight} />
        </div>
      </section>

      <section aria-labelledby="qr-heading" className="flex flex-col items-center gap-4">
        <h2 id="qr-heading" className="self-start text-sm font-medium text-neutral-400">
          QR code
        </h2>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt={`QR code menant à ${publicUrl}`}
          width={256}
          height={256}
          className="rounded-xl border border-white/10 bg-white p-3"
        />

        <div className="flex gap-2">
          <a
            href={downloadHref("png")}
            download
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5"
          >
            Télécharger PNG
          </a>
          <a
            href={downloadHref("svg")}
            download
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5"
          >
            Télécharger SVG
          </a>
        </div>
      </section>
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
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-transparent"
      />
    </label>
  );
}
