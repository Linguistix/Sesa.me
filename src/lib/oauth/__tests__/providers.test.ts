import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROVIDERS,
  configuredProviders,
  isProviderConfigured,
  isProviderId,
  providerCredentials,
  resolveEndpoints,
} from "../providers";

afterEach(() => vi.unstubAllEnvs());

describe("provider registry", () => {
  it("requests only read scopes — a data grant must not be able to write", () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const scope of provider.scopes) {
        expect(scope).not.toMatch(/write|modify|manage|delete|upload/i);
      }
    }
  });

  it("asks Google for offline access, or the refresh token never arrives", () => {
    expect(PROVIDERS.google.extraAuthorizeParams?.access_type).toBe("offline");
    expect(PROVIDERS.google.extraAuthorizeParams?.prompt).toBe("consent");
  });

  it("records where each provider wants the client secret", () => {
    expect(PROVIDERS.spotify.tokenAuth).toBe("basic");
    expect(PROVIDERS.google.tokenAuth).toBe("body");
  });

  it("uses https endpoints", () => {
    for (const provider of Object.values(PROVIDERS)) {
      expect(provider.authorizeUrl.startsWith("https://")).toBe(true);
      expect(provider.tokenUrl.startsWith("https://")).toBe(true);
    }
  });
});

describe("isProviderId", () => {
  it("accepts known providers and rejects everything else", () => {
    expect(isProviderId("spotify")).toBe(true);
    expect(isProviderId("google")).toBe(true);
    for (const value of ["", "SPOTIFY", "facebook", "__proto__", "../etc"]) {
      expect(isProviderId(value)).toBe(false);
    }
  });
});

describe("providerCredentials", () => {
  it("returns null unless both halves are present", () => {
    expect(providerCredentials(PROVIDERS.spotify)).toBeNull();

    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    expect(providerCredentials(PROVIDERS.spotify)).toBeNull();

    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    expect(providerCredentials(PROVIDERS.spotify)).toEqual({
      clientId: "id",
      clientSecret: "secret",
    });
  });
});

describe("configuredProviders", () => {
  it("lists only providers with credentials", () => {
    expect(configuredProviders()).toEqual([]);

    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");

    expect(configuredProviders().map((p) => p.id)).toEqual(["spotify"]);
    expect(isProviderConfigured("google")).toBe(false);
  });
});

describe("resolveEndpoints", () => {
  it("uses the real endpoints by default", () => {
    expect(resolveEndpoints(PROVIDERS.spotify).tokenUrl).toBe(
      "https://accounts.spotify.com/api/token",
    );
  });

  it("honours a test override, trailing slash and all", () => {
    vi.stubEnv("OAUTH_SPOTIFY_BASE_URL", "http://127.0.0.1:9100/");
    expect(resolveEndpoints(PROVIDERS.spotify)).toEqual({
      authorizeUrl: "http://127.0.0.1:9100/authorize",
      tokenUrl: "http://127.0.0.1:9100/token",
    });
  });

  it("keeps providers independent", () => {
    vi.stubEnv("OAUTH_SPOTIFY_BASE_URL", "http://127.0.0.1:9100");
    expect(resolveEndpoints(PROVIDERS.google).tokenUrl).toBe("https://oauth2.googleapis.com/token");
  });
});
