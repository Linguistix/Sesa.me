import "server-only";
import type { ProviderId } from "@/lib/oauth/providers";
import { isSafeProviderUrl } from "@/lib/oauth/urls";

export { isSafeProviderUrl };

/**
 * Calls against the connected provider's API.
 *
 * Every response is treated as untrusted input: only the fields needed are
 * read, URLs are validated before being stored on a page, and a missing field
 * degrades rather than throwing. A provider changing its response shape must
 * not take a creator's page down.
 */

/** Base URLs are overridable so the test suite can point at a mock provider. */
function apiBase(provider: ProviderId): string {
  const override = process.env[`OAUTH_${provider.toUpperCase()}_API_URL`];
  if (override) return override.replace(/\/+$/, "");
  return provider === "spotify" ? "https://api.spotify.com/v1" : "https://www.googleapis.com/youtube/v3";
}

async function callApi<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Provider API returned ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface ProviderIdentity {
  id: string;
  label: string | null;
}

/** Who the grant belongs to, so the dashboard can name the linked account. */
export async function fetchProviderIdentity(
  provider: ProviderId,
  accessToken: string,
): Promise<ProviderIdentity> {
  if (provider === "spotify") {
    const me = await callApi<{ id: string; display_name?: string; email?: string }>(
      `${apiBase("spotify")}/me`,
      accessToken,
    );
    return { id: me.id, label: me.display_name ?? me.email ?? null };
  }

  const channels = await callApi<{
    items?: Array<{ id: string; snippet?: { title?: string } }>;
  }>(`${apiBase("google")}/channels?part=snippet&mine=true`, accessToken);

  const channel = channels.items?.[0];
  if (!channel) throw new Error("No YouTube channel on this account.");

  return { id: channel.id, label: channel.snippet?.title ?? null };
}

export interface ResolvedContent {
  url: string;
  title: string;
}

/**
 * The creator's most recent Spotify release.
 *
 * Uses the saved-albums endpoint sorted by add date, which is what a creator's
 * own catalogue looks like from their account. Returns null rather than
 * throwing when there is simply nothing to show — a new artist with no
 * releases is not an error state.
 */
export async function fetchLatestSpotifyRelease(
  accessToken: string,
): Promise<ResolvedContent | null> {
  const albums = await callApi<{
    items?: Array<{
      album?: {
        name?: string;
        external_urls?: { spotify?: string };
        release_date?: string;
      };
    }>;
  }>(`${apiBase("spotify")}/me/albums?limit=10`, accessToken);

  const releases = (albums.items ?? [])
    .map((item) => item.album)
    .filter((album): album is NonNullable<typeof album> => Boolean(album?.external_urls?.spotify));

  if (releases.length === 0) return null;

  // Sorted here rather than trusting the endpoint's order, which is by date
  // added to the library, not by release date.
  releases.sort((a, b) => (b.release_date ?? "").localeCompare(a.release_date ?? ""));

  const latest = releases[0]!;
  const url = latest.external_urls!.spotify!;

  return isSafeProviderUrl(url, "open.spotify.com")
    ? { url, title: latest.name ?? "Dernière sortie" }
    : null;
}

/** The creator's most recent YouTube upload. */
export async function fetchLatestYouTubeVideo(
  accessToken: string,
): Promise<ResolvedContent | null> {
  const search = await callApi<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string };
    }>;
  }>(
    `${apiBase("google")}/search?part=snippet&forMine=true&type=video&order=date&maxResults=1`,
    accessToken,
  );

  const video = search.items?.[0];
  const videoId = video?.id?.videoId;
  if (!videoId || !/^[A-Za-z0-9_-]{5,64}$/.test(videoId)) return null;

  return {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: video?.snippet?.title ?? "Dernière vidéo",
  };
}
