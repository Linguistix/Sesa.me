/**
 * WCAG 2.1 relative-luminance and contrast maths, plus an automatic repair
 * pass for themes that fail AA.
 *
 * Phase 3 hands this module whatever the design model produced. The model is
 * *asked* for accessible colours in the system prompt, but asking is not a
 * guarantee, so every theme — generated or hand-written — is recomputed here
 * and corrected before it can reach a page.
 */

export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses `#abc` or `#aabbcc` into 0-255 channels. */
export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * WCAG relative luminance.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Contrast ratio between two colours, from 1 (identical) to 21 (black/white).
 * Order-independent.
 */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? AA_LARGE_TEXT : AA_NORMAL_TEXT);
}

// --- HSL conversion, used to nudge hue-preserving lightness -----------------

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  // Deliberately not rounded: rounding to whole degrees loses up to a whole
  // 8-bit channel on the way back through hslToRgb.
  h = h * 60;
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  const m = l - c / 2;
  return {
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  };
}

/**
 * Walks a foreground colour's lightness — keeping its hue and saturation —
 * until it clears `target` contrast against `background`.
 *
 * This is the "adapt the shade discreetly rather than disobey outright" rule
 * from the design brief: a user who asked for gold still gets gold, just a
 * legible shade of it. Direction is chosen by which side has more headroom, and
 * we fall back to black or white only if the whole ramp fails (which happens
 * for mid-grey backgrounds, where no same-hue shade can reach 4.5:1).
 */
export function adjustForContrast(
  foreground: string,
  background: string,
  target = AA_NORMAL_TEXT,
): string {
  if (contrastRatio(foreground, background) >= target) return foreground;

  const hsl = rgbToHsl(hexToRgb(foreground));
  const backgroundLuminance = relativeLuminance(background);
  // Dark background -> brighten the text, and vice versa.
  const directions = backgroundLuminance < 0.5 ? [1, -1] : [-1, 1];

  for (const direction of directions) {
    for (let step = 1; step <= 100; step++) {
      const l = hsl.l + direction * step * 0.01;
      if (l < 0 || l > 1) break;
      const candidate = rgbToHex(hslToRgb({ ...hsl, l }));
      if (contrastRatio(candidate, background) >= target) return candidate;
    }
  }

  // No shade of this hue works against this background: pick the safer pole.
  return backgroundLuminance < 0.5 ? "#FFFFFF" : "#000000";
}
