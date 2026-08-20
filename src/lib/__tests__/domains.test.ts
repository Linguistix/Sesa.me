import { describe, expect, it } from "vitest";
import { hostnameSchema } from "../domains";

describe("hostnameSchema", () => {
  it("accepts ordinary domains and subdomains", () => {
    for (const host of ["example.com", "liens.mon-site.fr", "a.b.c.co.uk", "my-site.io"]) {
      expect(hostnameSchema.safeParse(host).success).toBe(true);
    }
  });

  it("lowercases and trims", () => {
    expect(hostnameSchema.parse("  Liens.Example.COM ")).toBe("liens.example.com");
  });

  it("rejects a single label — it would be ambiguous as a routing key", () => {
    expect(hostnameSchema.safeParse("localhost").success).toBe(false);
    expect(hostnameSchema.safeParse("intranet").success).toBe(false);
  });

  it("rejects IP literals", () => {
    expect(hostnameSchema.safeParse("192.168.1.1").success).toBe(false);
    expect(hostnameSchema.safeParse("127.0.0.1").success).toBe(false);
  });

  it("rejects a host with a port, path, scheme or userinfo", () => {
    for (const host of [
      "example.com:8080",
      "example.com/path",
      "https://example.com",
      "user@example.com",
    ]) {
      expect(hostnameSchema.safeParse(host).success).toBe(false);
    }
  });

  it("rejects labels starting or ending with a hyphen", () => {
    for (const host of ["-bad.example.com", "bad-.example.com", "example.com-"]) {
      expect(hostnameSchema.safeParse(host).success).toBe(false);
    }
  });

  it("rejects a trailing dot and empty labels", () => {
    expect(hostnameSchema.safeParse("example.com.").success).toBe(false);
    expect(hostnameSchema.safeParse("a..b.com").success).toBe(false);
  });

  it("rejects overlong values", () => {
    expect(hostnameSchema.safeParse(`${"a".repeat(250)}.com`).success).toBe(false);
  });
});
