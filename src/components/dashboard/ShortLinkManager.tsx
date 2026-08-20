"use client";

import { useState, useTransition } from "react";
import { createShortLinkAction, deleteShortLinkAction } from "@/actions/billing";

export interface ShortLinkRow {
  id: string;
  code: string;
  title: string;
  targetUrl: string;
  clicks: number;
}

export function ShortLinkManager({
  baseUrl,
  shortLinks,
  candidates,
}: {
  baseUrl: string;
  shortLinks: ShortLinkRow[];
  candidates: Array<{ id: string; title: string; url: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(candidates[0]?.id ?? "");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // A link that already has a short code is not offered again.
  const shortened = new Set(shortLinks.map((s) => s.title));
  const available = candidates.filter((c) => !shortened.has(c.title));

  async function copy(code: string) {
    await navigator.clipboard.writeText(`${baseUrl}/${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {shortLinks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {shortLinks.map((short) => (
            <li
              key={short.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-200">{short.title}</p>
                <p className="truncate text-xs text-neutral-500">
                  {baseUrl}/{short.code}
                </p>
              </div>

              <span className="text-sm tabular-nums text-neutral-400">
                {short.clicks} clic{short.clicks === 1 ? "" : "s"}
              </span>

              <button
                type="button"
                onClick={() => copy(short.code)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-white/5"
              >
                {copiedCode === short.code ? "Copié ✓" : "Copier"}
              </button>

              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await deleteShortLinkAction(short.id);
                  })
                }
                className="rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {available.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-400">Raccourcir un lien</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-indigo-400"
            >
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={pending || !selected}
            onClick={() => {
              const candidate = available.find((c) => c.id === selected);
              if (!candidate) return;
              startTransition(async () => {
                await createShortLinkAction(candidate.id, candidate.url);
              });
            }}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {pending ? "…" : "Créer"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          {candidates.length === 0
            ? "Ajoutez d'abord un lien à votre page."
            : "Tous vos liens ont déjà un lien court."}
        </p>
      )}
    </div>
  );
}
