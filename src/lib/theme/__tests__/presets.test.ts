import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_PRESETS } from "../presets";
import { themeSchema, ALLOWED_FONTS } from "../schema";
import { auditContrast, sanitizeTheme } from "../sanitize";
import { contrastRatio } from "../contrast";
import { themeFontHref, themeToCssVars } from "../render";

describe("theme presets", () => {
  it("ships more than one preset and unique ids", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(THEME_PRESETS.map((p) => [p.id, p] as const))(
    "%s validates against the theme schema",
    (_id, preset) => {
      expect(() => themeSchema.parse(preset.theme)).not.toThrow();
    },
  );

  it.each(THEME_PRESETS.map((p) => [p.id, p] as const))(
    "%s passes WCAG AA on every critical pair",
    (_id, preset) => {
      expect(auditContrast(preset.theme)).toEqual([]);
    },
  );

  it.each(THEME_PRESETS.map((p) => [p.id, p] as const))(
    "%s uses only allow-listed fonts",
    (_id, preset) => {
      expect(ALLOWED_FONTS).toContain(preset.theme.typography.display_font);
      expect(ALLOWED_FONTS).toContain(preset.theme.typography.body_font);
    },
  );

  it("passes presets through sanitize without needing repair", () => {
    for (const preset of THEME_PRESETS) {
      const result = sanitizeTheme(preset.theme);
      expect(result.usedFallback).toBe(false);
      expect(result.fixes).toEqual([]);
    }
  });

  it("offers at least 50 fonts as promised in the product spec", () => {
    expect(ALLOWED_FONTS.length).toBeGreaterThanOrEqual(50);
  });
});

describe("DEFAULT_THEME", () => {
  it("is itself a valid, accessible theme", () => {
    expect(() => themeSchema.parse(DEFAULT_THEME)).not.toThrow();
    expect(auditContrast(DEFAULT_THEME)).toEqual([]);
  });
});

describe("themeToCssVars", () => {
  it("emits every variable the public page reads", () => {
    const vars = themeToCssVars(DEFAULT_THEME);
    for (const key of [
      "--sesame-bg",
      "--sesame-surface",
      "--sesame-accent",
      "--sesame-text",
      "--sesame-muted",
      "--sesame-font-display",
      "--sesame-font-body",
      "--sesame-radius",
      "--sesame-btn-bg",
      "--sesame-btn-text",
    ]) {
      expect(vars[key]).toBeTruthy();
    }
  });

  it("maps button shape to a radius", () => {
    const pill = themeToCssVars({
      ...DEFAULT_THEME,
      button_style: { ...DEFAULT_THEME.button_style, shape: "pill" },
    });
    expect(pill["--sesame-radius"]).toBe("9999px");

    const square = themeToCssVars({
      ...DEFAULT_THEME,
      button_style: { ...DEFAULT_THEME.button_style, shape: "square" },
    });
    expect(square["--sesame-radius"]).toBe("0");
  });

  it("builds a gradient only when the effect asks for one", () => {
    expect(themeToCssVars(DEFAULT_THEME)["--sesame-bg-image"]).toBe("none");

    const gradient = themeToCssVars({
      ...DEFAULT_THEME,
      background_effect: { kind: "gradient", secondary: "#2A0F4D", angle: 165 },
    });
    expect(gradient["--sesame-bg-image"]).toContain("linear-gradient(165deg");
  });
});

describe("themeFontHref", () => {
  it("requests both families, deduplicated", () => {
    const href = themeFontHref(DEFAULT_THEME)!;
    expect(href).toContain("family=Sora");
    expect(href).toContain("family=Inter");

    const single = themeFontHref({
      ...DEFAULT_THEME,
      typography: { display_font: "Inter", body_font: "Inter", weight: "regular" },
    })!;
    expect(single.match(/family=/g)).toHaveLength(1);
  });

  it("encodes spaces in multi-word family names", () => {
    const href = themeFontHref({
      ...DEFAULT_THEME,
      typography: { display_font: "Playfair Display", body_font: "Inter", weight: "regular" },
    })!;
    expect(href).toContain("family=Playfair+Display");
    expect(href).not.toContain(" ");
  });

  /*
    Error text on a public page used to be a fixed `#F87171`. It reads well on
    a dark theme and vanishes on a light one — the five light presets showed it
    between 2.45:1 and 2.77:1, so the message telling a visitor their address
    was rejected was the least legible thing on the page. `themeToCssVars` now
    repairs it against the page's own background.
  */
  it.each(THEME_PRESETS.map((p) => [p.id, p] as const))(
    "%s renders error text that clears AA against its own background",
    (_id, preset) => {
      const { theme } = sanitizeTheme(preset.theme);
      const critical = themeToCssVars(theme)["--sesame-critical"];
      expect(contrastRatio(critical, theme.palette.background)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
