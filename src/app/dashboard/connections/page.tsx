import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { listConnections } from "@/server/connections";
import { configuredProviders, PROVIDERS, type ProviderId } from "@/lib/oauth/providers";
import { ConnectionsPanel } from "@/components/dashboard/ConnectionsPanel";

export const metadata = { title: "Comptes connectés" };

const STATUS_MESSAGE: Record<string, string> = {
  connected: "Compte connecté.",
  cancelled: "Connexion annulée.",
  expired: "La demande a expiré. Relancez la connexion.",
  state_mismatch: "La vérification de sécurité a échoué. Relancez la connexion.",
  no_code: "Le fournisseur n'a pas renvoyé d'autorisation.",
  failed: "La connexion a échoué. Réessayez.",
  not_configured: "Ce fournisseur n'est pas configuré sur cette instance.",
  unknown_provider: "Fournisseur inconnu.",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  const params = await searchParams;
  const message = STATUS_MESSAGE[params.status ?? params.error ?? ""];

  const [connections, available] = await Promise.all([
    listConnections(session!.user.id),
    Promise.resolve(configuredProviders()),
  ]);

  const connectedIds = new Set(connections.map((c) => c.provider));
  const syncedBlocks = page.links.filter((l) => l.syncProvider !== null);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold">Comptes connectés</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Connectez un compte pour qu&apos;un bloc affiche automatiquement votre dernière sortie,
        sans mise à jour manuelle.
      </p>

      {message ? (
        <p
          role="status"
          className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200"
        >
          {message}
        </p>
      ) : null}

      <ConnectionsPanel
        connections={connections.map((c) => ({
          provider: c.provider,
          label: c.label,
          accountLabel: c.accountLabel,
        }))}
        availableProviders={available
          .filter((p) => !connectedIds.has(p.id))
          .map((p) => ({ id: p.id, label: p.label }))}
        unconfiguredProviders={(Object.keys(PROVIDERS) as ProviderId[])
          .filter((id) => !available.some((p) => p.id === id))
          .map((id) => PROVIDERS[id].label)}
        syncedBlocks={syncedBlocks.map((l) => ({
          id: l.id,
          title: l.title,
          syncedAt: l.syncedAt?.toISOString() ?? null,
          syncError: l.syncError,
        }))}
      />
    </div>
  );
}
