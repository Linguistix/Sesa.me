"use client";

import { useState, useTransition } from "react";
import { disconnectAction, syncNowAction } from "@/actions/connections";

export interface ConnectionRow {
  provider: string;
  label: string;
  accountLabel: string | null;
}

export interface SyncedBlockRow {
  id: string;
  title: string;
  syncedAt: string | null;
  syncError: string | null;
}

export function ConnectionsPanel({
  connections,
  availableProviders,
  unconfiguredProviders,
  syncedBlocks,
}: {
  connections: ConnectionRow[];
  availableProviders: Array<{ id: string; label: string }>;
  unconfiguredProviders: string[];
  syncedBlocks: SyncedBlockRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="connected-heading">
        <h2 id="connected-heading" className="mb-3 text-sm font-medium text-neutral-400">
          Vos comptes
        </h2>

        {connections.length === 0 && availableProviders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-neutral-500">
            Aucun fournisseur configuré sur cette instance.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {connections.map((connection) => (
              <li
                key={connection.provider}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-200">{connection.label}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {connection.accountLabel ?? "Compte connecté"}
                  </p>
                </div>

                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  Connecté
                </span>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await disconnectAction(connection.provider);
                    })
                  }
                  className="rounded-lg px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Déconnecter
                </button>
              </li>
            ))}

            {availableProviders.map((provider) => (
              <li
                key={provider.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <p className="min-w-0 flex-1 text-sm text-neutral-200">{provider.label}</p>

                {/* A link, not a fetch: the OAuth flow is a top-level redirect
                    to the provider, which an XHR cannot perform. */}
                <a
                  href={`/api/connections/${provider.id}/start`}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400"
                >
                  Connecter
                </a>
              </li>
            ))}
          </ul>
        )}

        {unconfiguredProviders.length > 0 ? (
          <p className="mt-3 text-xs text-neutral-600">
            Non configurés sur cette instance : {unconfiguredProviders.join(", ")}. Renseignez les
            identifiants OAuth correspondants pour les activer.
          </p>
        ) : null}
      </section>

      {syncedBlocks.length > 0 ? (
        <section aria-labelledby="synced-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="synced-heading" className="text-sm font-medium text-neutral-400">
              Blocs synchronisés
            </h2>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setResult(null);
                  const outcome = await syncNowAction();
                  setResult(
                    outcome.error
                      ? outcome.error
                      : outcome.changed
                        ? `${outcome.changed} bloc(s) mis à jour.`
                        : "Tout est déjà à jour.",
                  );
                })
              }
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-white/5 disabled:opacity-50"
            >
              {pending ? "Synchronisation…" : "Synchroniser maintenant"}
            </button>
          </div>

          {result ? (
            <p role="status" className="mb-3 text-xs text-neutral-400">
              {result}
            </p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {syncedBlocks.map((block) => (
              <li
                key={block.id}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <p className="text-sm text-neutral-200">{block.title}</p>
                {block.syncError ? (
                  <p className="mt-0.5 text-xs text-amber-300">⚠ {block.syncError}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {block.syncedAt
                      ? `Mis à jour ${new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(block.syncedAt))}`
                      : "Pas encore synchronisé"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
