import { describe, expect, it } from "vitest";
import {
  adjustForContrast,
  contrastRatio,
  hexToRgb,
  hslToRgb,
  meetsAA,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
} from "../contrast";

describe("hexToRgb", () => {
  it("parses six-digit hex", () => {
    expect(hexToRgb("#1A2B3C")).toEqual({ r: 26, g: 43, b: 60 });
  });

  it("expands three-digit shorthand", () => {
    expect(hexToRgb("#abc")).toEqual(hexToRgb("#aabbcc"));
  });

  it("rejects malformed input", () => {
    expect(() => hexToRgb("#12345")).toThrow(/Invalid hex/);
    expect(() => hexToRgb("rebeccapurple")).toThrow(/Invalid hex/);
  });
});

describe("relativeLuminance", () => {
  it("anchors at the WCAG endpoints", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
  });

  it("returns 1 for identical colours", () => {
    expect(contrastRatio("#6366F1", "#6366F1")).toBeCloseTo(1, 5);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#123456", "#EEEEEE")).toBeCloseTo(
      contrastRatio("#EEEEEE", "#123456"),
      10,
    );
  });

  it("matches known reference values", () => {
    // #767676 on white is the canonical "exactly passes AA" grey.
    expect(contrastRatio("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeLessThan(4.55);
  });
});

describe("meetsAA", () => {
  it("applies the 4.5:1 threshold to normal text", () => {
    expect(meetsAA("#767676", "#FFFFFF")).toBe(true);
    expect(meetsAA("#999999", "#FFFFFF")).toBe(false);
  });

  it("applies the looser 3:1 threshold to large text", () => {
    expect(meetsAA("#949494", "#FFFFFF", true)).toBe(true);
    expect(meetsAA("#949494", "#FFFFFF", false)).toBe(false);
  });
});

describe("hsl round-trip", () => {
  it("survives conversion in both directions", () => {
    for (const hex of ["#C9A44C", "#0E0E12", "#38BDF8", "#FFFFFF", "#000000", "#7F7F7F"]) {
      const back = rgbToHex(hslToRgb(rgbToHsl(hexToRgb(hex))));
      expect(back.toLowerCase()).toBe(hex.toLowerCase());
    }
  });
});

describe("adjustForContrast", () => {
  it("leaves already-compliant colours untouched", () => {
    expect(adjustForContrast("#FFFFFF", "#000000")).toBe("#FFFFFF");
  });

  it("fixes light-on-light", () => {
    const fixed = adjustForContrast("#EEEEEE", "#FFFFFF");
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("fixes dark-on-dark", () => {
    const fixed = adjustForContrast("#111111", "#0E0E12");
    expect(contrastRatio(fixed, "#0E0E12")).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves hue while correcting — gold stays gold", () => {
    const goldOnCream = adjustForContrast("#C9A44C", "#FBFAF7");
    const originalHue = rgbToHsl(hexToRgb("#C9A44C")).h;
    const correctedHue = rgbToHsl(hexToRgb(goldOnCream)).h;
    expect(Math.abs(correctedHue - originalHue)).toBeLessThanOrEqual(2);
    expect(contrastRatio(goldOnCream, "#FBFAF7")).toBeGreaterThanOrEqual(4.5);
  });

  it("honours the large-text target when asked", () => {
    const fixed = adjustForContrast("#B0B0B0", "#FFFFFF", 3);
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(3);
    // Should stop at 3:1 rather than over-darkening to 4.5:1.
    expect(contrastRatio(fixed, "#FFFFFF")).toBeLessThan(4.5);
  });

  it("resolves the hardest case — a colour against itself", () => {
    // Every hue ramp passes through black and white, so the walk can always
    // find a compliant shade; mid-grey is the tightest squeeze there is.
    const fixed = adjustForContrast("#808080", "#808080");
    expect(contrastRatio(fixed, "#808080")).toBeGreaterThanOrEqual(4.5);
  });

  it("always terminates and always improves, over a broad sweep", () => {
    const samples = ["#000000", "#333333", "#767676", "#AAAAAA", "#FFFFFF", "#C9A44C", "#B14BFF", "#38BDF8"];
    for (const bg of samples) {
      for (const fg of samples) {
        const fixed = adjustForContrast(fg, bg);
        expect(contrastRatio(fixed, bg)).toBeGreaterThanOrEqual(
          Math.min(contrastRatio(fg, bg), 4.5) - 0.01,
        );
      }
    }
  });
});
