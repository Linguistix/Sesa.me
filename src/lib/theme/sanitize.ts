import { themeSchema, type Theme } from "./schema";
import { AA_LARGE_TEXT, AA_NORMAL_TEXT, adjustForContrast, contrastRatio } from "./contrast";
import { DEFAULT_THEME } from "./presets";

export interface ContrastFix {
  /** Which colour pair failed, e.g. "text_primary on background". */
  pair: string;
  before: string;
  after: string;
  ratioBefore: number;
  ratioAfter: number;
}

export interface SanitizeResult {
  theme: Theme;
  /** Corrections applied so the UI can tell the user what was adjusted. */
  fixes: ContrastFix[];
  /** True when the input failed schema validation and the default was used. */
  usedFallback: boolean;
}

/**
 * The colour pairs a reader actually has to decipher on a rendered page.
 * `large` marks pairs that only need AA large-text contrast (3:1) because they
 * are rendered at >= 18.66px bold / 24px regular.
 */
function criticalPairs(theme: Theme) {
  const { palette, button_style } = theme;
  // A solid button paints the accent behind its label; outline and glass
  // buttons keep the page background behind it.
  const buttonBackground = button_style.fill === "solid" ? palette.accent : palette.background;

  return [
    { key: "text_primary on background", fg: palette.text_primary, bg: palette.background, large: false },
    { key: "text_muted on background", fg: palette.text_muted, bg: palette.background, large: false },
    { key: "text_primary on surface", fg: palette.text_primary, bg: palette.surface, large: false },
    { key: "button label on button", fg: buttonLabel(theme), bg: buttonBackground, large: false },
    { key: "accent on background", fg: palette.accent, bg: palette.background, large: true },
  ] as const;
}

/**
 * The colour a button's label is painted in: solid buttons need a label that
 * reads against the accent, everything else reuses the page text colour.
 */
export function buttonLabel(theme: Theme): string {
  if (theme.button_style.fill !== "solid") return theme.palette.text_primary;
  // Pick whichever pole reads better on the accent, then let the repair pass
  // verify it like any other pair.
  const onWhite = contrastRatio("#FFFFFF", theme.palette.accent);
  const onBlack = contrastRatio("#000000", theme.palette.accent);
  return onWhite >= onBlack ? "#FFFFFF" : "#000000";
}

/**
 * Recomputes every critical contrast pair and repairs the ones that fail AA.
 *
 * Backgrounds are treated as fixed and foregrounds are moved, because the
 * background carries most of the "mood" a user asked for — shifting a text
 * colour a few percent is far less visible than repainting the page.
 */
export function enforceContrast(theme: Theme): { theme: Theme; fixes: ContrastFix[] } {
  const fixes: ContrastFix[] = [];
  const next: Theme = structuredClone(theme);

  const repair = (
    pair: string,
    fg: string,
    bg: string,
    large: boolean,
    apply: (corrected: string) => void,
  ) => {
    const target = large ? AA_LARGE_TEXT : AA_NORMAL_TEXT;
    const ratioBefore = contrastRatio(fg, bg);
    if (ratioBefore >= target) return;

    const corrected = adjustForContrast(fg, bg, target);
    apply(corrected);
    fixes.push({
      pair,
      before: fg,
      after: corrected,
      ratioBefore: round2(ratioBefore),
      ratioAfter: round2(contrastRatio(corrected, bg)),
    });
  };

  // Order matters: text_primary is repaired against the background first, then
  // the same (possibly corrected) colour is checked against the surface.
  repair(
    "text_primary on background",
    next.palette.text_primary,
    next.palette.background,
    false,
    (c) => (next.palette.text_primary = c),
  );
  repair(
    "text_muted on background",
    next.palette.text_muted,
    next.palette.background,
    false,
    (c) => (next.palette.text_muted = c),
  );
  repair(
    "text_primary on surface",
    next.palette.text_primary,
    next.palette.surface,
    false,
    (c) => (next.palette.text_primary = c),
  );
  // A surface that swallows text after the pass above gets nudged itself,
  // since we have already spent the text colour's headroom on the background.
  repair(
    "accent on background",
    next.palette.accent,
    next.palette.background,
    true,
    (c) => (next.palette.accent = c),
  );

  return { theme: next, fixes };
}

/**
 * Validate, then repair. This is the only supported path from untrusted theme
 * data (AI output, an API client, a hand-edited JSON column) to something the
 * renderer will accept.
 *
 * A theme that fails validation falls back to the default silently rather than
 * rendering a broken page, per the design brief's guardrails.
 */
export function sanitizeTheme(input: unknown): SanitizeResult {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) {
    return { theme: DEFAULT_THEME, fixes: [], usedFallback: true };
  }
  const { theme, fixes } = enforceContrast(parsed.data);
  return { theme, fixes, usedFallback: false };
}

/** Reports failing pairs without changing anything. Used by tests and the editor. */
export function auditContrast(theme: Theme) {
  return criticalPairs(theme)
    .map((p) => ({
      pair: p.key,
      ratio: round2(contrastRatio(p.fg, p.bg)),
      required: p.large ? AA_LARGE_TEXT : AA_NORMAL_TEXT,
      passes: contrastRatio(p.fg, p.bg) >= (p.large ? AA_LARGE_TEXT : AA_NORMAL_TEXT),
    }))
    .filter((r) => !r.passes);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
