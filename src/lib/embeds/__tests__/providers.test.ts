import { describe, expect, it } from "vitest";
import { detectEmbed, withParentHost } from "../providers";

describe("Spotify", () => {
  it("recognises tracks, albums and playlists", () => {
    expect(detectEmbed("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")).toMatchObject({
      provider: "spotify",
      src: "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
    });
    expect(detectEmbed("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3")?.src).toContain(
      "/embed/album/",
    );
  });

  it("handles the localised /intl-xx/ prefix", () => {
    expect(detectEmbed("https://open.spotify.com/intl-fr/track/4cOdK2wGLETKBW3PvgPWqT")).toMatchObject({
      src: "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
    });
  });

  it("drops query parameters rather than forwarding them", () => {
    const embed = detectEmbed("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123");
    expect(embed?.src).toBe("https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT");
  });

  it("rejects unknown resource kinds and malformed ids", () => {
    expect(detectEmbed("https://open.spotify.com/user/someone")).toBeNull();
    expect(detectEmbed("https://open.spotify.com/track/../../evil")).toBeNull();
    expect(detectEmbed("https://open.spotify.com/track/")).toBeNull();
  });
});

describe("YouTube", () => {
  it("recognises every common URL shape", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(detectEmbed(url)?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });

  it("uses the no-cookie host so tracking is deferred until playback", () => {
    expect(detectEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toContain("youtube-nocookie.com");
  });

  it("rejects a malformed video id", () => {
    expect(detectEmbed("https://www.youtube.com/watch?v=")).toBeNull();
    expect(detectEmbed("https://www.youtube.com/watch?v=<script>")).toBeNull();
  });
});

describe("SoundCloud", () => {
  it("builds a player URL with the track encoded as a parameter", () => {
    const embed = detectEmbed("https://soundcloud.com/artist/track-name");
    expect(embed?.provider).toBe("soundcloud");
    expect(embed?.src).toContain(encodeURIComponent("https://soundcloud.com/artist/track-name"));
  });

  it("rejects path segments outside the expected character set", () => {
    expect(detectEmbed("https://soundcloud.com/artist/<script>")).toBeNull();
  });
});

describe("Apple Music", () => {
  it("rewrites to the embed host and keeps a track selector", () => {
    const embed = detectEmbed("https://music.apple.com/fr/album/mon-album/1234567890?i=1234567891");
    expect(embed?.src).toBe(
      "https://embed.music.apple.com/fr/album/mon-album/1234567890?i=1234567891",
    );
  });

  it("ignores an unsafe track selector rather than forwarding it", () => {
    const embed = detectEmbed("https://music.apple.com/fr/album/x/123?i=%22onload%3D");
    expect(embed?.src).not.toContain("onload");
  });
});

describe("Twitch", () => {
  it("requires the embedding host to be declared", () => {
    const embed = detectEmbed("https://twitch.tv/somechannel")!;
    expect(embed.src).toContain("PARENT_HOST");

    const resolved = withParentHost(embed, "sesa.me");
    expect(resolved.src).toContain("parent=sesa.me");
    expect(resolved.src).not.toContain("PARENT_HOST");
  });

  it("encodes the parent host", () => {
    const embed = withParentHost(detectEmbed("https://twitch.tv/chan")!, "a b");
    expect(embed.src).toContain("parent=a%20b");
  });

  it("leaves non-Twitch embeds untouched", () => {
    const spotify = detectEmbed("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")!;
    expect(withParentHost(spotify, "sesa.me")).toEqual(spotify);
  });
});

describe("anything else", () => {
  it.each([
    ["a plain website", "https://example.com/page"],
    ["a lookalike host", "https://open.spotify.com.evil.test/track/abc"],
    ["a subdomain trick", "https://evil.test/open.spotify.com/track/abc"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["not a URL", "just some text"],
    ["empty", ""],
  ])("is not embedded: %s", (_label, url) => {
    expect(detectEmbed(url)).toBeNull();
  });

  it("never returns a src outside the provider's own host", () => {
    const allowedHosts = [
      "open.spotify.com",
      "embed.music.apple.com",
      "w.soundcloud.com",
      "www.youtube-nocookie.com",
      "player.twitch.tv",
    ];

    for (const url of [
      "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      "https://music.apple.com/fr/album/x/123",
      "https://soundcloud.com/a/b",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://twitch.tv/chan",
    ]) {
      const embed = detectEmbed(url)!;
      expect(allowedHosts).toContain(new URL(embed.src).host);
    }
  });
});
