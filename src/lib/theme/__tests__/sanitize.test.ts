import { describe, expect, it } from "vitest";
import { auditContrast, buttonLabel, enforceContrast, sanitizeTheme } from "../sanitize";
import { DEFAULT_THEME } from "../presets";
import { contrastRatio } from "../contrast";
import type { Theme } from "../schema";

/** A theme that deliberately violates AA in several places. */
const UNREADABLE: Theme = {
  palette: {
    background: "#FFFFFF",
    surface: "#FEFEFE",
    accent: "#FFFDE7",
    text_primary: "#FAFAFA",
    text_muted: "#F5F5F5",
  },
  typography: { display_font: "Inter", body_font: "Inter", weight: "regular" },
  button_style: { shape: "pill", shadow: false, border: false, fill: "solid" },
  layout: "centered",
  background_effect: { kind: "none", angle: 160 },
  avatar_shape: "circle",
  mood_tags: ["white on white"],
};

describe("sanitizeTheme", () => {
  it("passes a valid, accessible theme through unchanged", () => {
    const result = sanitizeTheme(DEFAULT_THEME);
    expect(result.usedFallback).toBe(false);
    expect(result.fixes).toEqual([]);
    expect(result.theme).toEqual(DEFAULT_THEME);
  });

  it("falls back to the default rather than rendering a broken page", () => {
    for (const bad of [
      null,
      undefined,
      {},
      "a string",
      { palette: { background: "not-a-colour" } },
      { ...DEFAULT_THEME, palette: { ...DEFAULT_THEME.palette, background: "#GGGGGG" } },
    ]) {
      const result = sanitizeTheme(bad);
      expect(result.usedFallback).toBe(true);
      expect(result.theme).toEqual(DEFAULT_THEME);
    }
  });

  it("rejects a font outside the allow-list", () => {
    const result = sanitizeTheme({
      ...DEFAULT_THEME,
      typography: { ...DEFAULT_THEME.typography, body_font: "Comic Sans MS" },
    });
    expect(result.usedFallback).toBe(true);
  });

  it("repairs an unreadable theme instead of discarding it", () => {
    const result = sanitizeTheme(UNREADABLE);

    expect(result.usedFallback).toBe(false);
    expect(result.fixes.length).toBeGreaterThan(0);
    // The whole point: what comes out is readable.
    expect(auditContrast(result.theme)).toEqual([]);
  });

  it("keeps the user's background — it repairs foregrounds only", () => {
    const result = sanitizeTheme(UNREADABLE);
    expect(result.theme.palette.background).toBe(UNREADABLE.palette.background);
    expect(result.theme.palette.surface).toBe(UNREADABLE.palette.surface);
  });

  it("reports what it changed, with before and after ratios", () => {
    const { fixes } = enforceContrast(UNREADABLE);
    const fix = fixes.find((f) => f.pair === "text_primary on background");

    expect(fix).toBeDefined();
    expect(fix!.before).toBe("#FAFAFA");
    expect(fix!.ratioBefore).toBeLessThan(4.5);
    expect(fix!.ratioAfter).toBeGreaterThanOrEqual(4.5);
  });
});

describe("buttonLabel", () => {
  it("picks the pole that reads best on a solid accent", () => {
    const onDarkAccent = buttonLabel({
      ...DEFAULT_THEME,
      palette: { ...DEFAULT_THEME.palette, accent: "#111111" },
    });
    expect(onDarkAccent).toBe("#FFFFFF");

    const onLightAccent = buttonLabel({
      ...DEFAULT_THEME,
      palette: { ...DEFAULT_THEME.palette, accent: "#FFF9C4" },
    });
    expect(onLightAccent).toBe("#000000");
  });

  it("reuses the page text colour for outline and glass buttons", () => {
    for (const fill of ["outline", "glass"] as const) {
      const label = buttonLabel({
        ...DEFAULT_THEME,
        button_style: { ...DEFAULT_THEME.button_style, fill },
      });
      expect(label).toBe(DEFAULT_THEME.palette.text_primary);
    }
  });

  it("always yields a legible label on a solid button", () => {
    for (const accent of ["#C9A44C", "#6366F1", "#FFFFFF", "#000000", "#4ADE80", "#FF7A59"]) {
      const theme = { ...DEFAULT_THEME, palette: { ...DEFAULT_THEME.palette, accent } };
      expect(contrastRatio(buttonLabel(theme), accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("enforceContrast", () => {
  it("is idempotent — repairing a repaired theme changes nothing", () => {
    const once = enforceContrast(UNREADABLE).theme;
    const twice = enforceContrast(once);
    expect(twice.fixes).toEqual([]);
    expect(twice.theme).toEqual(once);
  });

  it("does not mutate its input", () => {
    const snapshot = structuredClone(UNREADABLE);
    enforceContrast(UNREADABLE);
    expect(UNREADABLE).toEqual(snapshot);
  });
});
