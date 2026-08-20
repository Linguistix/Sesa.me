import { describe, expect, it } from "vitest";
import { avatarAllowed, looksAnimated } from "../avatar";
import { faviconUrl } from "../favicon";

describe("looksAnimated", () => {
  it("recognises the animated formats", () => {
    for (const url of [
      "https://cdn.example.com/me.gif",
      "https://cdn.example.com/me.WEBP",
      "https://cdn.example.com/path/me.apng",
    ]) {
      expect(looksAnimated(url)).toBe(true);
    }
  });

  it("ignores the query string, which is not part of the filename", () => {
    expect(looksAnimated("https://cdn.example.com/me.jpg?v=.gif")).toBe(false);
    expect(looksAnimated("https://cdn.example.com/me.gif?v=2")).toBe(true);
  });

  it("leaves still formats alone", () => {
    for (const url of ["https://cdn.example.com/me.jpg", "https://cdn.example.com/me.png"]) {
      expect(looksAnimated(url)).toBe(false);
    }
  });

  it("does not throw on a malformed URL", () => {
    expect(looksAnimated("not a url")).toBe(false);
  });
});

describe("avatarAllowed", () => {
  it("lets Pro use anything", () => {
    expect(avatarAllowed("https://cdn.example.com/me.gif", true)).toBe(true);
  });

  it("blocks an animated avatar on the free plan", () => {
    expect(avatarAllowed("https://cdn.example.com/me.gif", false)).toBe(false);
  });

  it("allows a still avatar and no avatar on any plan", () => {
    expect(avatarAllowed("https://cdn.example.com/me.png", false)).toBe(true);
    expect(avatarAllowed(null, false)).toBe(true);
  });
});

describe("faviconUrl", () => {
  it("points at the destination's own origin, not a third-party service", () => {
    expect(faviconUrl("https://example.com/some/deep/path?q=1")).toBe(
      "https://example.com/favicon.ico",
    );
    // Nothing should route through a tracker.
    expect(faviconUrl("https://example.com/x")).not.toContain("google");
  });

  it("keeps a non-default port, which is part of the origin", () => {
    expect(faviconUrl("https://example.com:8443/x")).toBe("https://example.com:8443/favicon.ico");
  });

  it("returns null for missing or non-http URLs", () => {
    for (const url of [null, "", "javascript:alert(1)", "not a url"]) {
      expect(faviconUrl(url)).toBeNull();
    }
  });
});
