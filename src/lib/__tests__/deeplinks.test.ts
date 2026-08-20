import { describe, expect, it } from "vitest";
import { isInAppBrowser, toDeepLink } from "../deeplinks";

describe("toDeepLink", () => {
  it("maps a Spotify URL onto its URI scheme", () => {
    expect(toDeepLink("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")).toEqual({
      nativeUrl: "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
      webUrl: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    });
  });

  it("handles Spotify's localised path prefix", () => {
    expect(toDeepLink("https://open.spotify.com/intl-fr/album/abc123")?.nativeUrl).toBe(
      "spotify:album:abc123",
    );
  });

  it("maps YouTube watch and short URLs", () => {
    expect(toDeepLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.nativeUrl).toBe(
      "vnd.youtube://dQw4w9WgXcQ",
    );
    expect(toDeepLink("https://youtu.be/dQw4w9WgXcQ")?.nativeUrl).toBe(
      "vnd.youtube://dQw4w9WgXcQ",
    );
  });

  it("maps social profile URLs", () => {
    expect(toDeepLink("https://instagram.com/someone")?.nativeUrl).toBe(
      "instagram://user?username=someone",
    );
    expect(toDeepLink("https://x.com/someone")?.nativeUrl).toBe(
      "twitter://user?screen_name=someone",
    );
    expect(toDeepLink("https://www.tiktok.com/@someone")?.nativeUrl).toBe(
      "snssdk1128://user/profile/someone",
    );
  });

  it("always keeps the original https URL as the fallback", () => {
    const link = toDeepLink("https://open.spotify.com/track/abc123")!;
    expect(link.webUrl).toBe("https://open.spotify.com/track/abc123");
  });

  it("returns null for anything it does not recognise", () => {
    for (const url of [
      "https://example.com",
      "https://instagram.com/p/some-post/",
      "not a url",
      "javascript:alert(1)",
      "",
    ]) {
      expect(toDeepLink(url)).toBeNull();
    }
  });

  it("never builds a scheme URL from an unvalidated identifier", () => {
    for (const url of [
      "https://open.spotify.com/track/../../evil",
      "https://youtu.be/<script>",
      "https://instagram.com/a b",
    ]) {
      const link = toDeepLink(url);
      if (link) {
        expect(link.nativeUrl).not.toContain("<");
        expect(link.nativeUrl).not.toContain(" ");
        expect(link.nativeUrl).not.toContain("..");
      }
    }
  });
});

describe("isInAppBrowser", () => {
  it("detects the embedded browsers deep linking is for", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone) Instagram 300.0.0.0",
      "Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/400.0]",
      "Mozilla/5.0 (Linux; Android 14) musical_ly_2022",
      "Mozilla/5.0 (iPhone) Snapchat/12.0",
    ]) {
      expect(isInAppBrowser(ua)).toBe(true);
    }
  });

  it("leaves ordinary browsers alone, where https already reaches the app", () => {
    for (const ua of [
      "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1",
      null,
    ]) {
      expect(isInAppBrowser(ua)).toBe(false);
    }
  });
});
