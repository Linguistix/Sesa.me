import { describe, expect, it } from "vitest";
import { sanitizeTheme, auditContrast } from "@/lib/theme/sanitize";
import { DEFAULT_THEME } from "@/lib/theme/presets";
import { themeToCssVars, themeFontHref } from "@/lib/theme/render";
import { contrastRatio } from "@/lib/theme/contrast";

/**
 * These tests treat the model as untrusted input.
 *
 * The design engine's safety does not rest on the model behaving — it rests on
 * every generated theme passing through `sanitizeTheme` before it can render.
 * Each case below is something a model could plausibly emit.
 */

function generatedOutput(overrides: Record<string, unknown>) {
  return { ...structuredClone(DEFAULT_THEME), ...overrides };
}

describe("a model that ignores the contrast rule", () => {
  it("gets its unreadable theme repaired, not rejected", () => {
    const whiteOnWhite = generatedOutput({
      palette: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        accent: "#FFFFFF",
        text_primary: "#FFFFFF",
        text_muted: "#FEFEFE",
      },
    });

    const { theme, usedFallback, fixes } = sanitizeTheme(whiteOnWhite);

    expect(usedFallback).toBe(false);
    expect(fixes.length).toBeGreaterThan(0);
    expect(auditContrast(theme)).toEqual([]);
  });

  it("keeps the requested mood — gold on cream stays gold", () => {
    const goldOnCream = generatedOutput({
      palette: {
        background: "#FBF7EC",
        surface: "#FFFDF6",
        accent: "#E3C77A",
        text_primary: "#E8D9A8",
        text_muted: "#DCCB9E",
      },
    });

    const { theme } = sanitizeTheme(goldOnCream);

    // The background the user described is untouched...
    expect(theme.palette.background).toBe("#FBF7EC");
    // ...and the text is now legible against it.
    expect(contrastRatio(theme.palette.text_primary, theme.palette.background)).toBeGreaterThanOrEqual(4.5);
    expect(auditContrast(theme)).toEqual([]);
  });
});

describe("a model that returns something malformed", () => {
  it.each([
    ["prose instead of JSON", "Voici un joli thème sombre !"],
    ["null", null],
    ["an empty object", {}],
    ["an array", []],
    ["a partial theme", { palette: { background: "#000000" } }],
    ["an invalid hex value", { ...DEFAULT_THEME, palette: { ...DEFAULT_THEME.palette, accent: "gold" } }],
    ["a hex value with the wrong length", { ...DEFAULT_THEME, palette: { ...DEFAULT_THEME.palette, accent: "#12345" } }],
  ])("falls back silently for %s", (_label, output) => {
    const { theme, usedFallback } = sanitizeTheme(output);
    expect(usedFallback).toBe(true);
    expect(theme).toEqual(DEFAULT_THEME);
  });
});

describe("a model that tries to escape the schema", () => {
  it("cannot introduce a font outside the allow-list", () => {
    const smuggled = generatedOutput({
      typography: { display_font: "Comic Sans MS", body_font: "Inter", weight: "medium" },
    });

    const { theme, usedFallback } = sanitizeTheme(smuggled);
    expect(usedFallback).toBe(true);
    expect(theme.typography.display_font).toBe(DEFAULT_THEME.typography.display_font);
  });

  it("cannot inject CSS through a font name", () => {
    const injection = generatedOutput({
      typography: {
        display_font: "Inter; } body { display: none } .x {",
        body_font: "Inter",
        weight: "medium",
      },
    });

    const { theme, usedFallback } = sanitizeTheme(injection);
    expect(usedFallback).toBe(true);

    // Whatever renders, the font stack contains only allow-listed names.
    const vars = themeToCssVars(theme);
    expect(vars["--sesame-font-display"]).not.toContain("display: none");
    expect(vars["--sesame-font-display"]).not.toContain("}");
  });

  it("cannot inject a URL through a font name", () => {
    const injection = generatedOutput({
      typography: {
        display_font: "Inter&family=Evil:wght@400&x=",
        body_font: "Inter",
        weight: "regular",
      },
    });

    const { theme } = sanitizeTheme(injection);
    const href = themeFontHref(theme);

    expect(href).not.toContain("Evil");
    expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/);
  });

  it("cannot inject markup through a mood tag", () => {
    const injection = generatedOutput({ mood_tags: ["<script>alert(1)</script>"] });
    const { theme, usedFallback } = sanitizeTheme(injection);

    // Over-long tags are rejected outright; anything that survives is only
    // ever rendered as React text, never as HTML.
    expect(usedFallback).toBe(true);
    expect(theme.mood_tags).toEqual(DEFAULT_THEME.mood_tags);
  });

  it("cannot smuggle an unexpected key into the rendered output", () => {
    const extra = { ...structuredClone(DEFAULT_THEME), evil_css: "body{display:none}" };
    const { theme } = sanitizeTheme(extra);

    expect(Object.values(theme)).not.toContain("body{display:none}");
    const vars = themeToCssVars(theme);
    expect(JSON.stringify(vars)).not.toContain("display:none");
  });
});

describe("the rendered output of any generated theme", () => {
  it("only ever produces CSS variable values, never rules", () => {
    // A CSS variable value cannot close its declaration, so no generated
    // value can escape into a new rule. Confirm nothing carries a brace.
    const themes = [
      DEFAULT_THEME,
      sanitizeTheme(generatedOutput({ background_effect: { kind: "mesh", angle: 200 } })).theme,
      sanitizeTheme(generatedOutput({ background_effect: { kind: "gradient", secondary: "#123456", angle: 45 } })).theme,
    ];

    for (const theme of themes) {
      for (const value of Object.values(themeToCssVars(theme))) {
        expect(value).not.toContain("}");
        expect(value).not.toContain("<");
      }
    }
  });
});
