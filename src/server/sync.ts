import "server-only";
import { prisma } from "@/lib/db";
import { accessTokenFor } from "@/server/connections";
import { fetchLatestSpotifyRelease, fetchLatestYouTubeVideo } from "@/server/provider-data";
import type { SyncProvider } from "@/generated/prisma/enums";
import type { ProviderId } from "@/lib/oauth/providers";

/** How long a synced block's content is considered fresh. */
const SYNC_TTL_MS = 30 * 60 * 1000;

const PROVIDER_FOR: Record<SyncProvider, ProviderId> = {
  SPOTIFY_LATEST_RELEASE: "spotify",
  YOUTUBE_LATEST_VIDEO: "google",
};

/**
 * Refreshes synced blocks on a page.
 *
 * Called from the editor and from a scheduled job — deliberately *not* from
 * the public page render. A visitor's page load must never wait on a
 * third-party API: the public page reads whatever was last resolved, which is
 * why the resolved values are written back to `url` and `title` rather than
 * being fetched on demand.
 *
 * `force` bypasses the freshness window. The window exists to avoid hammering
 * the provider on automatic syncs; it must not turn a user pressing
 * "synchronise now" into a no-op that still reports success.
 *
 * Returns the number of blocks whose content actually changed.
 */
export async function syncPage(
  pageId: string,
  userId: string,
  options: { force?: boolean } = {},
): Promise<number> {
  const links = await prisma.link.findMany({
    where: { pageId, syncProvider: { not: null } },
  });

  let changed = 0;

  for (const link of links) {
    const provider = link.syncProvider!;
    const stale = !link.syncedAt || Date.now() - link.syncedAt.getTime() > SYNC_TTL_MS;
    if (!stale && !options.force) continue;

    const result = await resolveOne(userId, provider);

    if (!result.ok) {
      await prisma.link.update({
        where: { id: link.id },
        // The block keeps its last known content; only the error is recorded,
        // so a revoked token shows up in the editor instead of blanking a
        // creator's page.
        data: { syncedAt: new Date(), syncError: result.error },
      });
      continue;
    }

    const unchanged = link.url === result.content.url && link.title === result.content.title;

    await prisma.link.update({
      where: { id: link.id },
      data: {
        url: result.content.url,
        title: result.content.title,
        syncedAt: new Date(),
        syncError: null,
      },
    });

    if (!unchanged) changed += 1;
  }

  return changed;
}

type ResolveResult =
  | { ok: true; content: { url: string; title: string } }
  | { ok: false; error: string };

async function resolveOne(userId: string, provider: SyncProvider): Promise<ResolveResult> {
  const token = await accessTokenFor(userId, PROVIDER_FOR[provider]);
  if (!token) {
    return { ok: false, error: "Compte non connecté ou autorisation expirée." };
  }

  try {
    const content =
      provider === "SPOTIFY_LATEST_RELEASE"
        ? await fetchLatestSpotifyRelease(token)
        : await fetchLatestYouTubeVideo(token);

    if (!content) return { ok: false, error: "Aucun contenu trouvé sur ce compte." };
    return { ok: true, content };
  } catch (error) {
    console.error(`[sync] ${provider} failed`, error);
    return { ok: false, error: "Le fournisseur n'a pas répondu." };
  }
}

/** Which sync providers a user can currently use, given their connections. */
export async function availableSyncProviders(userId: string): Promise<SyncProvider[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, type: "oauth" },
    select: { provider: true },
  });

  const connected = new Set(accounts.map((a) => a.provider));
  const available: SyncProvider[] = [];

  if (connected.has("spotify")) available.push("SPOTIFY_LATEST_RELEASE");
  if (connected.has("google")) available.push("YOUTUBE_LATEST_VIDEO");

  return available;
}
