import { describe, expect, it } from "vitest";
import { ALPHABET, generateCode, isValidCode } from "../shortcode";

describe("ALPHABET", () => {
  it("excludes the glyphs that are confused when read aloud or typed", () => {
    // Base58 keeps `1` and drops its look-alikes, rather than the reverse.
    for (const ambiguous of ["0", "O", "l", "I"]) {
      expect(ALPHABET).not.toContain(ambiguous);
    }
    expect(ALPHABET).toContain("1");
  });

  it("has no duplicate characters", () => {
    expect(new Set(ALPHABET).size).toBe(ALPHABET.length);
  });
});

describe("generateCode", () => {
  it("produces codes of the requested length from the alphabet", () => {
    for (const length of [3, 7, 12]) {
      const code = generateCode(length);
      expect(code).toHaveLength(length);
      expect([...code].every((c) => ALPHABET.includes(c))).toBe(true);
    }
  });

  it("does not repeat across many draws", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateCode()));
    expect(codes.size).toBe(2000);
  });

  it("distributes characters without obvious modulo bias", () => {
    // Rejection sampling should keep every character within a loose band of
    // the expected frequency; plain `% ALPHABET.length` would skew the first
    // 256 % 58 = 24 characters noticeably high.
    const counts = new Map<string, number>();
    const draws = 40_000;
    for (let i = 0; i < draws / 8; i++) {
      for (const c of generateCode(8)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    const expected = draws / ALPHABET.length;
    for (const char of ALPHABET) {
      const count = counts.get(char) ?? 0;
      expect(count).toBeGreaterThan(expected * 0.7);
      expect(count).toBeLessThan(expected * 1.3);
    }
  });
});

describe("isValidCode", () => {
  it("accepts codes it generated", () => {
    for (let i = 0; i < 20; i++) expect(isValidCode(generateCode())).toBe(true);
  });

  it("rejects out-of-range lengths", () => {
    expect(isValidCode("ab")).toBe(false);
    expect(isValidCode("a".repeat(17))).toBe(false);
  });

  it("rejects characters outside the alphabet, including path traversal", () => {
    for (const bad of ["abc0", "abcO", "ab/cd", "../etc", "abc-def", ""]) {
      expect(isValidCode(bad)).toBe(false);
    }
  });
});
