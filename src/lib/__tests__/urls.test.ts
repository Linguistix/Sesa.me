import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl, baseUrl, displayHost } from "../urls";

const original = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = original;
  vi.unstubAllEnvs();
});

describe("baseUrl", () => {
  it("uses the configured app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sesa.me");
    expect(baseUrl()).toBe("https://sesa.me");
  });

  it("strips trailing slashes so paths do not double up", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sesa.me///");
    expect(appUrl("/camille")).toBe("https://sesa.me/camille");
  });

  it("tolerates a path with no leading slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sesa.me");
    expect(appUrl("camille")).toBe("https://sesa.me/camille");
  });
});

describe("displayHost", () => {
  it("shows just the host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sesa.me/base");
    expect(displayHost()).toBe("sesa.me");
  });

  it("falls back rather than throwing on a malformed value", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
    expect(displayHost()).toBe("sesa.me");
  });
});
