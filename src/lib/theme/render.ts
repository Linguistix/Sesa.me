import type { Theme } from "./schema";
import { ALLOWED_FONTS } from "./schema";
import { buttonLabel } from "./sanitize";

const WEIGHT_MAP: Record<Theme["typography"]["weight"], number> = {
  light: 300,
  regular: 400,
  medium: 500,
  bold: 700,
};

const RADIUS_MAP: Record<Theme["button_style"]["shape"], string> = {
  rounded: "0.75rem",
  pill: "9999px",
  square: "0",
};

const AVATAR_RADIUS_MAP: Record<Theme["avatar_shape"], string> = {
  circle: "9999px",
  rounded: "1.25rem",
  square: "0",
};

/**
 * Flattens a theme into the CSS custom properties the public page reads.
 *
 * Returning a plain object (rather than a CSS string) keeps this injectable as
 * a React `style` prop, which means no `dangerouslySetInnerHTML` anywhere in
 * the theming path — the renderer interprets the config, it never evaluates it.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const { palette, typography, button_style, background_effect } = theme;

  const backgroundImage =
    background_effect.kind === "gradient"
      ? `linear-gradient(${background_effect.angle}deg, ${palette.background}, ${background_effect.secondary ?? palette.surface})`
      : background_effect.kind === "radial"
        ? `radial-gradient(circle at 50% 0%, ${background_effect.secondary ?? palette.surface}, ${palette.background} 70%)`
        : background_effect.kind === "mesh"
          ? `radial-gradient(at 20% 15%, ${background_effect.secondary ?? palette.accent}55 0px, transparent 50%), radial-gradient(at 80% 40%, ${palette.accent}33 0px, transparent 50%)`
          : "none";

  return {
    "--sesame-bg": palette.background,
    "--sesame-bg-image": backgroundImage,
    "--sesame-surface": palette.surface,
    "--sesame-accent": palette.accent,
    "--sesame-text": palette.text_primary,
    "--sesame-muted": palette.text_muted,
    "--sesame-font-display": `"${typography.display_font}", ${fallbackStack(typography.display_font)}`,
    "--sesame-font-body": `"${typography.body_font}", ${fallbackStack(typography.body_font)}`,
    "--sesame-weight": String(WEIGHT_MAP[typography.weight]),
    "--sesame-radius": RADIUS_MAP[button_style.shape],
    "--sesame-avatar-radius": AVATAR_RADIUS_MAP[theme.avatar_shape],
    "--sesame-btn-bg": buttonBackground(theme),
    "--sesame-btn-text": buttonLabel(theme),
    "--sesame-btn-border": button_style.border
      ? `1px solid ${button_style.fill === "solid" ? "transparent" : palette.accent}`
      : "1px solid transparent",
    "--sesame-btn-shadow": button_style.shadow ? "0 6px 20px rgba(0,0,0,0.28)" : "none",
    "--sesame-btn-backdrop": button_style.fill === "glass" ? "blur(12px)" : "none",
  };
}

function buttonBackground(theme: Theme): string {
  switch (theme.button_style.fill) {
    case "solid":
      return theme.palette.accent;
    case "glass":
      return `${theme.palette.surface}B3`;
    case "outline":
      return "transparent";
  }
}

/** Generic family to fall back to while the webfont loads, or if it fails. */
function fallbackStack(font: string): string {
  const serif = [
    "Playfair Display", "Merriweather", "Lora", "PT Serif", "Libre Baskerville",
    "Cormorant Garamond", "EB Garamond", "Crimson Text", "Bitter", "Domine",
    "Spectral", "Fraunces", "Instrument Serif", "DM Serif Display", "Abril Fatface",
  ];
  const mono = ["JetBrains Mono", "IBM Plex Mono", "Space Mono", "Roboto Mono", "Fira Code"];
  const display = ["Bebas Neue", "Oswald", "Anton", "Righteous", "Pacifico", "Caveat", "Dancing Script", "Lobster"];

  if (mono.includes(font)) return "ui-monospace, SFMono-Regular, Menlo, monospace";
  if (serif.includes(font)) return "Georgia, 'Times New Roman', serif";
  if (display.includes(font)) return "system-ui, sans-serif";
  return "system-ui, -apple-system, 'Segoe UI', sans-serif";
}

/**
 * Builds the Google Fonts stylesheet URL for a theme's two families.
 *
 * The font names come from the schema's allow-list, so they cannot be
 * attacker-controlled, but they are still URI-encoded on the way out.
 */
export function themeFontHref(theme: Theme): string | null {
  const families = Array.from(
    new Set([theme.typography.display_font, theme.typography.body_font]),
  ).filter((f) => (ALLOWED_FONTS as readonly string[]).includes(f));

  if (families.length === 0) return null;

  const params = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
