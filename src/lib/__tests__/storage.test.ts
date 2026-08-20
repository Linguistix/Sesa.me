import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  buildObjectKey,
  formatBytes,
  isOwnStorageUrl,
  isStorageConfigured,
  publicUrlFor,
  keyFromPublicUrl,
  resetStorageForTests,
  validateUpload,
} from "../storage";

afterEach(() => {
  vi.unstubAllEnvs();
  resetStorageForTests();
});

function configure() {
  vi.stubEnv("S3_BUCKET", "sesame-media");
  vi.stubEnv("S3_ACCESS_KEY_ID", "key");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("S3_ENDPOINT", "https://storage.example.com");
}

describe("allowed types", () => {
  it("accepts the raster formats a browser can display", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
      expect(ALLOWED_IMAGE_TYPES[type]).toBeTruthy();
    }
  });

  it("excludes SVG, which can carry script and would be stored XSS", () => {
    expect(ALLOWED_IMAGE_TYPES["image/svg+xml"]).toBeUndefined();
  });

  it("excludes documents and anything HTML-ish", () => {
    for (const type of ["text/html", "application/pdf", "application/xhtml+xml", "text/plain"]) {
      expect(ALLOWED_IMAGE_TYPES[type]).toBeUndefined();
    }
  });
});

describe("validateUpload", () => {
  it("accepts a normal image", () => {
    expect(
      validateUpload({ purpose: "avatar", contentType: "image/png", contentLength: 50_000 }),
    ).toEqual({ ok: true });
  });

  it("rejects a disallowed type with a message naming what is allowed", () => {
    const result = validateUpload({
      purpose: "avatar",
      contentType: "image/svg+xml",
      contentLength: 1000,
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/png/);
  });

  it("enforces the per-purpose size cap", () => {
    expect(
      validateUpload({
        purpose: "avatar",
        contentType: "image/png",
        contentLength: MAX_UPLOAD_BYTES.avatar + 1,
      }).ok,
    ).toBe(false);

    // The same file is fine as a gallery image, which has a larger cap.
    expect(
      validateUpload({
        purpose: "gallery",
        contentType: "image/png",
        contentLength: MAX_UPLOAD_BYTES.avatar + 1,
      }).ok,
    ).toBe(true);
  });

  it("rejects nonsense sizes", () => {
    for (const contentLength of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateUpload({ purpose: "avatar", contentType: "image/png", contentLength }).ok).toBe(
        false,
      );
    }
  });
});

describe("buildObjectKey", () => {
  it("namespaces by user and purpose", () => {
    const key = buildObjectKey({
      userId: "user123",
      purpose: "gallery",
      contentType: "image/png",
      random: "abc",
    });
    expect(key).toBe("uploads/user123/gallery/abc.png");
  });

  it("derives the extension from the content type, not from any filename", () => {
    expect(
      buildObjectKey({ userId: "u", purpose: "avatar", contentType: "image/jpeg", random: "r" }),
    ).toBe("uploads/u/avatar/r.jpg");
  });

  it("strips anything that could introduce a path separator", () => {
    const key = buildObjectKey({
      userId: "../../etc/passwd",
      purpose: "avatar",
      contentType: "image/png",
      random: "r",
    });
    expect(key).not.toContain("..");
    expect(key.split("/")).toHaveLength(4);
  });

  it("gives different users different prefixes, so one cannot overwrite another", () => {
    const a = buildObjectKey({ userId: "alice", purpose: "avatar", contentType: "image/png" });
    const b = buildObjectKey({ userId: "bob", purpose: "avatar", contentType: "image/png" });
    expect(a.startsWith("uploads/alice/")).toBe(true);
    expect(b.startsWith("uploads/bob/")).toBe(true);
  });

  it("is unpredictable, so keys cannot be guessed and overwritten", () => {
    const keys = new Set(
      Array.from({ length: 200 }, () =>
        buildObjectKey({ userId: "u", purpose: "avatar", contentType: "image/png" }),
      ),
    );
    expect(keys.size).toBe(200);
  });

  it("refuses to build a key for an unsupported type", () => {
    expect(() =>
      buildObjectKey({ userId: "u", purpose: "avatar", contentType: "image/svg+xml" }),
    ).toThrow(/Unsupported/);
  });
});

describe("configuration", () => {
  it("reports unconfigured when any credential is missing", () => {
    expect(isStorageConfigured()).toBe(false);

    vi.stubEnv("S3_BUCKET", "b");
    expect(isStorageConfigured()).toBe(false);

    vi.stubEnv("S3_ACCESS_KEY_ID", "k");
    expect(isStorageConfigured()).toBe(false);

    vi.stubEnv("S3_SECRET_ACCESS_KEY", "s");
    expect(isStorageConfigured()).toBe(true);
  });
});

describe("publicUrlFor", () => {
  it("prefers the CDN base when one is set", () => {
    configure();
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.sesa.me/");
    expect(publicUrlFor("uploads/u/avatar/x.png")).toBe("https://cdn.sesa.me/uploads/u/avatar/x.png");
  });

  it("falls back to the endpoint and bucket", () => {
    configure();
    expect(publicUrlFor("uploads/u/avatar/x.png")).toBe(
      "https://storage.example.com/sesame-media/uploads/u/avatar/x.png",
    );
  });
});

describe("isOwnStorageUrl", () => {
  it("recognises our own objects", () => {
    configure();
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.sesa.me");
    expect(isOwnStorageUrl("https://cdn.sesa.me/uploads/u/avatar/x.png")).toBe(true);
  });

  it("rejects other hosts, so a delete is never aimed elsewhere", () => {
    configure();
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.sesa.me");
    for (const url of [
      "https://evil.example.com/uploads/u/avatar/x.png",
      "https://cdn.sesa.me.evil.com/uploads/x.png",
      "not a url",
    ]) {
      expect(isOwnStorageUrl(url)).toBe(false);
    }
  });

  it("rejects our host outside the uploads prefix", () => {
    configure();
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.sesa.me");
    expect(isOwnStorageUrl("https://cdn.sesa.me/secrets/config.json")).toBe(false);
  });

  it("is false when storage is not configured at all", () => {
    expect(isOwnStorageUrl("https://cdn.sesa.me/uploads/x.png")).toBe(false);
  });
});

describe("keyFromPublicUrl", () => {
  it("recovers the key from a URL", () => {
    expect(keyFromPublicUrl("https://cdn.sesa.me/uploads/u/avatar/x.png")).toBe(
      "uploads/u/avatar/x.png",
    );
  });

  it("handles a path-style endpoint with the bucket in the path", () => {
    expect(keyFromPublicUrl("https://s.example.com/bucket/uploads/u/avatar/x.png")).toBe(
      "uploads/u/avatar/x.png",
    );
  });

  it("returns null for a URL with no uploads segment", () => {
    expect(keyFromPublicUrl("https://cdn.sesa.me/other/x.png")).toBeNull();
    expect(keyFromPublicUrl("nonsense")).toBeNull();
  });
});

describe("formatBytes", () => {
  it("scales the unit", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2 Ko");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 Mo");
  });
});
