"use client";

import { useState, useTransition } from "react";
import { disconnectAction, syncNowAction } from "@/actions/connections";
import { Panel, SectionHeader, Badge, EmptyState } from "@/components/ui/Panel";
import { Button, ButtonAnchor } from "@/components/ui/Button";

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
    <div className="flex flex-col gap-5">
      <Panel className="p-5" aria-labelledby="connected-heading">
        <SectionHeader
          id="connected-heading"
          title="Vos comptes"
          description="Un compte connecté tient les blocs correspondants à jour tout seul."
        />

        {connections.length === 0 && availableProviders.length === 0 ? (
          <EmptyState
            title="Aucun fournisseur configuré"
            description="Renseignez des identifiants OAuth sur cette instance pour proposer des connexions."
          />
        ) : (
          <ul className="flex flex-col">
            {connections.map((connection) => (
              <li
                key={connection.provider}
                className="flex flex-wrap items-center gap-3 border-t border-white/6 py-3 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base text-ink-100">{connection.label}</p>
                  <p className="truncate text-xs text-ink-400">
                    {connection.accountLabel ?? "Compte connecté"}
                  </p>
                </div>

                <Badge tone="positive">Connecté</Badge>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await disconnectAction(connection.provider);
                    })
                  }
                >
                  Déconnecter
                </Button>
              </li>
            ))}

            {availableProviders.map((provider) => (
              <li
                key={provider.id}
                className="flex flex-wrap items-center gap-3 border-t border-white/6 py-3 first:border-t-0 first:pt-0"
              >
                <p className="min-w-0 flex-1 text-base text-ink-300">{provider.label}</p>

                {/* A link, not a fetch: the OAuth flow is a top-level redirect
                    to the provider, which an XHR cannot perform. */}
                <ButtonAnchor
                  href={`/api/connections/${provider.id}/start`}
                  variant="secondary"
                  size="sm"
                >
                  Connecter
                </ButtonAnchor>
              </li>
            ))}
          </ul>
        )}

        {unconfiguredProviders.length > 0 ? (
          <p className="mt-4 border-t border-white/6 pt-3 text-xs text-ink-400">
            Non configurés sur cette instance : {unconfiguredProviders.join(", ")}. Renseignez les
            identifiants OAuth correspondants pour les activer.
          </p>
        ) : null}
      </Panel>

      {syncedBlocks.length > 0 ? (
        <Panel className="p-5" aria-labelledby="synced-heading">
          <SectionHeader
            id="synced-heading"
            title="Blocs synchronisés"
            description="Ces blocs reprennent automatiquement les données du compte lié."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
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
              >
                {pending ? "Synchronisation…" : "Synchroniser maintenant"}
              </Button>
            }
          />

          {result ? (
            <p role="status" className="mb-3 text-xs text-ink-300">
              {result}
            </p>
          ) : null}

          <ul className="flex flex-col">
            {syncedBlocks.map((block) => (
              <li key={block.id} className="border-t border-white/6 py-3 first:border-t-0 first:pt-0">
                <p className="text-base text-ink-100">{block.title}</p>
                {block.syncError ? (
                  <p className="mt-0.5 text-xs text-caution-400">⚠ {block.syncError}</p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink-400">
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
        </Panel>
      ) : null}
    </div>
  );
}
