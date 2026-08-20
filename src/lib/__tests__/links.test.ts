import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, linkInputSchema } from "../links";

describe("isSafeHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/path?q=1#frag")).toBe(true);
  });

  it("rejects script-bearing schemes that would be stored XSS", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(isSafeHttpUrl(url)).toBe(false);
    }
  });

  it("rejects relative and malformed URLs", () => {
    for (const url of ["", "example.com", "/relative", "://nope", "http:/"]) {
      expect(isSafeHttpUrl(url)).toBe(false);
    }
  });
});

describe("linkInputSchema", () => {
  const base = { title: "Mon lien", isActive: true };

  it("requires a URL for link and social blocks", () => {
    for (const type of ["LINK", "SOCIAL"] as const) {
      const result = linkInputSchema.safeParse({ ...base, type });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].path).toEqual(["url"]);
    }
  });

  it("does not require a URL for headings and text blocks", () => {
    for (const type of ["HEADING", "TEXT"] as const) {
      expect(linkInputSchema.safeParse({ ...base, type }).success).toBe(true);
    }
  });

  it("rejects an unsafe URL with a message aimed at the url field", () => {
    const result = linkInputSchema.safeParse({
      ...base,
      type: "LINK",
      url: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(["url"]);
  });

  it("requires a non-empty title", () => {
    expect(linkInputSchema.safeParse({ title: "   ", type: "HEADING" }).success).toBe(false);
  });

  it("enforces the length caps", () => {
    expect(
      linkInputSchema.safeParse({ ...base, title: "a".repeat(81), type: "HEADING" }).success,
    ).toBe(false);
    expect(
      linkInputSchema.safeParse({ ...base, type: "TEXT", body: "a".repeat(1001) }).success,
    ).toBe(false);
  });

  it("distinguishes an absent password from an empty one", () => {
    // Absent leaves an existing gate alone; empty is an explicit "remove it".
    const absent = linkInputSchema.parse({ ...base, type: "HEADING" });
    expect(absent.password).toBeUndefined();

    const cleared = linkInputSchema.parse({ ...base, type: "HEADING", password: "" });
    expect(cleared.password).toBe("");
  });

  it("defaults type to LINK and isActive to true", () => {
    const parsed = linkInputSchema.parse({ title: "x", url: "https://example.com" });
    expect(parsed.type).toBe("LINK");
    expect(parsed.isActive).toBe(true);
  });
});
