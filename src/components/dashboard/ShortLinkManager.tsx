"use client";

import { useState, useTransition } from "react";
import { createShortLinkAction, deleteShortLinkAction } from "@/actions/billing";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

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
        <ul className="flex flex-col">
          {shortLinks.map((short) => (
            <li
              key={short.id}
              className="group flex flex-wrap items-center gap-3 border-t border-white/6 py-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base text-ink-100">{short.title}</p>
                <p className="truncate font-mono text-xs text-ink-400">
                  {baseUrl}/{short.code}
                </p>
              </div>

              <span className="tabular shrink-0 text-sm text-ink-300">
                {short.clicks} clic{short.clicks === 1 ? "" : "s"}
              </span>

              <Button type="button" variant="secondary" size="sm" onClick={() => copy(short.code)}>
                {copiedCode === short.code ? "Copié" : "Copier"}
              </Button>

              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    await deleteShortLinkAction(short.id);
                  })
                }
              >
                Supprimer
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {available.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-white/6 pt-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-300">Raccourcir un lien</span>
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </label>

          <Button
            type="button"
            variant="primary"
            disabled={pending || !selected}
            onClick={() => {
              const candidate = available.find((c) => c.id === selected);
              if (!candidate) return;
              startTransition(async () => {
                await createShortLinkAction(candidate.id, candidate.url);
              });
            }}
          >
            {pending ? "Création…" : "Créer"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-400">
          {candidates.length === 0
            ? "Ajoutez d'abord un lien à votre page."
            : "Tous vos liens ont déjà un lien court."}
        </p>
      )}
    </div>
  );
}
