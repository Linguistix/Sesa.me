import { describe, expect, it } from "vitest";
import { isSafeProviderUrl } from "../urls";

describe("isSafeProviderUrl", () => {
  it("accepts an https URL on the expected host", () => {
    expect(isSafeProviderUrl("https://open.spotify.com/album/abc", "open.spotify.com")).toBe(true);
  });

  it("rejects a different host, however plausible", () => {
    for (const url of [
      "https://open.spotify.com.evil.test/album/abc",
      "https://evil.test/open.spotify.com/album/abc",
      "https://spotify.com/album/abc",
    ]) {
      expect(isSafeProviderUrl(url, "open.spotify.com")).toBe(false);
    }
  });

  it("rejects non-https, including javascript: from a compromised response", () => {
    for (const url of [
      "http://open.spotify.com/album/abc",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "not a url",
      "",
    ]) {
      expect(isSafeProviderUrl(url, "open.spotify.com")).toBe(false);
    }
  });
});
