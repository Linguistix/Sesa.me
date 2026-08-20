import { z } from "zod";

/**
 * The theme contract.
 *
 * This schema is the single source of truth for what a page can look like.
 * Phase 1 fills it from hand-built presets; Phase 3 has the AI design engine
 * emit exactly this shape as structured output. Nothing renders a theme that
 * has not passed `themeSchema.parse` first — the renderer interprets this
 * config, it never executes model-authored markup or CSS.
 */

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex colour like #1A2B3C");

export const paletteSchema = z.object({
  background: hexColor,
  surface: hexColor,
  accent: hexColor,
  text_primary: hexColor,
  text_muted: hexColor,
});

/**
 * Fonts are an allow-list, never free text: the value is interpolated into a
 * Google Fonts URL and a CSS font-family, so an open string would be an
 * injection point as well as a rendering risk.
 */
export const ALLOWED_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans 3",
  "Raleway",
  "Nunito",
  "Work Sans",
  "Rubik",
  "Karla",
  "Manrope",
  "DM Sans",
  "Outfit",
  "Plus Jakarta Sans",
  "Figtree",
  "Sora",
  "Space Grotesk",
  "Chivo",
  "Archivo",
  "Barlow",
  "Cabin",
  "Mulish",
  "Urbanist",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "PT Serif",
  "Libre Baskerville",
  "Cormorant Garamond",
  "EB Garamond",
  "Crimson Text",
  "Bitter",
  "Domine",
  "Spectral",
  "Fraunces",
  "Instrument Serif",
  "DM Serif Display",
  "Abril Fatface",
  "Bebas Neue",
  "Oswald",
  "Anton",
  "Righteous",
  "Pacifico",
  "Caveat",
  "Dancing Script",
  "Lobster",
  "Comfortaa",
  "Quicksand",
  "JetBrains Mono",
  "IBM Plex Mono",
  "Space Mono",
  "Roboto Mono",
  "Fira Code",
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export const fontSchema = z.enum(ALLOWED_FONTS);

export const typographySchema = z.object({
  display_font: fontSchema,
  body_font: fontSchema,
  weight: z.enum(["light", "regular", "medium", "bold"]),
});

export const buttonStyleSchema = z.object({
  shape: z.enum(["rounded", "pill", "square"]),
  shadow: z.boolean(),
  border: z.boolean(),
  fill: z.enum(["solid", "outline", "glass"]).default("solid"),
});

export const backgroundEffectSchema = z.object({
  kind: z.enum(["none", "gradient", "radial", "mesh"]).default("none"),
  /// Second colour of the gradient. Ignored when kind is "none".
  secondary: hexColor.optional(),
  /// Gradient angle in degrees.
  angle: z.number().int().min(0).max(360).default(160),
});

export const themeSchema = z.object({
  palette: paletteSchema,
  typography: typographySchema,
  button_style: buttonStyleSchema,
  layout: z.enum(["centered", "left", "grid"]),
  background_effect: backgroundEffectSchema.default({ kind: "none", angle: 160 }),
  avatar_shape: z.enum(["circle", "rounded", "square"]).default("circle"),
  mood_tags: z.array(z.string().min(1).max(24)).max(6).default([]),
});

export type Theme = z.infer<typeof themeSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type ButtonStyle = z.infer<typeof buttonStyleSchema>;
