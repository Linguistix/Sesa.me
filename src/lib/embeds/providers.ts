/**
 * Recognised media providers and how to turn a public URL into an embed.
 *
 * Every provider is matched against an explicit host allow-list and its embed
 * URL is *rebuilt* from parsed identifiers rather than passed through. A URL
 * that does not match a known shape is not embedded at all — it stays an
 * ordinary link. This is what keeps an arbitrary user-supplied URL from
 * becoming the `src` of an iframe.
 */

export type EmbedProvider = "spotify" | "apple-music" | "soundcloud" | "youtube" | "twitch";

export interface Embed {
  provider: EmbedProvider;
  /** The rebuilt embed URL, safe to use as an iframe src. */
  src: string;
  /** Iframe height in pixels. */
  height: number;
  title: string;
  /** Whether the iframe needs the autoplay permission (all of ours do not). */
  allow: string;
}

/** Identifiers are always alphanumeric in these providers' URL schemes. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function detectEmbed(rawUrl: string): Embed | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.host.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  return (
    spotify(host, segments) ??
    appleMusic(host, url) ??
    soundcloud(host, url) ??
    youtube(host, segments, url) ??
    twitch(host, segments) ??
    null
  );
}

function spotify(host: string, segments: string[]): Embed | null {
  if (host !== "open.spotify.com") return null;

  // /track/<id>, /album/<id>, /playlist/<id>, /artist/<id>, and the
  // /intl-fr/track/<id> localised variants.
  const path = segments[0]?.startsWith("intl-") ? segments.slice(1) : segments;
  const [kind, id] = path;

  if (!kind || !id || !ID.test(id)) return null;
  if (!["track", "album", "playlist", "artist", "episode", "show"].includes(kind)) return null;

  return {
    provider: "spotify",
    src: `https://open.spotify.com/embed/${kind}/${id}`,
    height: kind === "track" ? 152 : 352,
    title: "Lecteur Spotify",
    allow: "clipboard-write; encrypted-media; fullscreen; picture-in-picture",
  };
}

function appleMusic(host: string, url: URL): Embed | null {
  if (host !== "music.apple.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  // /<storefront>/<kind>/<slug>/<id>
  const kind = segments[1];
  if (!kind || !["album", "playlist", "song", "artist"].includes(kind)) return null;

  // Apple's embed host mirrors the original path exactly, so it is rebuilt
  // from the validated path rather than reusing the input string.
  const safePath = segments
    .filter((s) => /^[A-Za-z0-9._~-]+$/.test(s))
    .join("/");
  if (safePath !== segments.join("/")) return null;

  const trackId = url.searchParams.get("i");
  const query = trackId && ID.test(trackId) ? `?i=${trackId}` : "";

  return {
    provider: "apple-music",
    src: `https://embed.music.apple.com/${safePath}${query}`,
    height: kind === "song" ? 175 : 450,
    title: "Lecteur Apple Music",
    allow: "autoplay *; encrypted-media *; clipboard-write",
  };
}

function soundcloud(host: string, url: URL): Embed | null {
  if (host !== "soundcloud.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  if (!segments.every((s) => /^[A-Za-z0-9._-]+$/.test(s))) return null;

  // SoundCloud's player takes the track URL as a query parameter, so it is
  // reassembled from validated segments and URL-encoded.
  const trackUrl = `https://soundcloud.com/${segments.join("/")}`;

  return {
    provider: "soundcloud",
    src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&color=%23ff5500&hide_related=true&show_comments=false&show_teaser=false`,
    height: 166,
    title: "Lecteur SoundCloud",
    allow: "autoplay; clipboard-write; encrypted-media",
  };
}

function youtube(host: string, segments: string[], url: URL): Embed | null {
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = segments[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (segments[0] === "watch") videoId = url.searchParams.get("v");
    else if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
      videoId = segments[1] ?? null;
    }
  } else {
    return null;
  }

  if (!videoId || !ID.test(videoId)) return null;

  return {
    provider: "youtube",
    // nocookie defers YouTube's tracking cookies until the visitor plays.
    src: `https://www.youtube-nocookie.com/embed/${videoId}`,
    height: 200,
    title: "Lecteur YouTube",
    allow: "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
  };
}

function twitch(host: string, segments: string[]): Embed | null {
  if (host !== "twitch.tv") return null;

  const channel = segments[0];
  if (!channel || !ID.test(channel)) return null;

  // Twitch refuses to render unless the embedding host is declared, so the
  // parent is filled in at render time from the app's configured domain.
  return {
    provider: "twitch",
    src: `https://player.twitch.tv/?channel=${channel}&parent=PARENT_HOST&muted=true`,
    height: 300,
    title: `Chaîne Twitch ${channel}`,
    allow: "autoplay; fullscreen",
  };
}

/** Fills in the `parent` placeholder Twitch requires. */
export function withParentHost(embed: Embed, host: string): Embed {
  if (!embed.src.includes("PARENT_HOST")) return embed;
  return { ...embed, src: embed.src.replace("PARENT_HOST", encodeURIComponent(host)) };
}
