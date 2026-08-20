import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugSchema, slugify } from "../slug";

const accepts = (s: string) => slugSchema.safeParse(s).success;

describe("slugSchema", () => {
  it("accepts ordinary handles", () => {
    for (const s of ["camille", "dj-nova", "a1", "x-y-z", "user2024"]) {
      expect(accepts(s)).toBe(true);
    }
  });

  it("lowercases and trims before validating", () => {
    expect(slugSchema.parse("  Camille  ")).toBe("camille");
  });

  it("rejects slugs that are too short or too long", () => {
    expect(accepts("a")).toBe(false);
    expect(accepts("a".repeat(33))).toBe(false);
    expect(accepts("a".repeat(32))).toBe(true);
  });

  it("rejects leading and trailing hyphens", () => {
    expect(accepts("-camille")).toBe(false);
    expect(accepts("camille-")).toBe(false);
  });

  it("rejects double hyphens, which read as typos and confuse punycode", () => {
    expect(accepts("dj--nova")).toBe(false);
  });

  it("rejects characters that would need escaping in a URL", () => {
    for (const s of ["hé", "a b", "a/b", "a.b", "a_b", "a%20b", "<script>"]) {
      expect(accepts(s)).toBe(false);
    }
  });

  it("rejects every reserved route so a user cannot shadow the app", () => {
    for (const reserved of RESERVED_SLUGS) {
      if (reserved.length < 2) continue;
      expect(accepts(reserved)).toBe(false);
    }
  });

  it("reserves the top-level routes the app actually serves", () => {
    for (const route of ["api", "dashboard", "login", "signup", "_next"]) {
      expect(RESERVED_SLUGS.has(route)).toBe(true);
    }
  });
});

describe("slugify", () => {
  it("strips accents rather than dropping the letters", () => {
    expect(slugify("Camille Dupré")).toBe("camille-dupre");
  });

  it("collapses punctuation and whitespace into single hyphens", () => {
    expect(slugify("DJ   Nova!! (Official)")).toBe("dj-nova-official");
  });

  it("never emits a leading or trailing hyphen", () => {
    for (const input of ["  hello  ", "!!!hello!!!", "--hello--", "a".repeat(40) + " x"]) {
      const result = slugify(input);
      expect(result.startsWith("-")).toBe(false);
      expect(result.endsWith("-")).toBe(false);
    }
  });

  it("produces something the schema accepts, for realistic names", () => {
    for (const name of ["Camille Dupré", "DJ Nova", "Ötzi", "李雷 Music", "a"]) {
      const slug = slugify(name);
      // Reserved words are the one case the caller must resolve itself.
      if (RESERVED_SLUGS.has(slug)) continue;
      expect(slugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it("pads a name too short to be a valid slug", () => {
    expect(slugify("a").length).toBeGreaterThanOrEqual(2);
  });
});
