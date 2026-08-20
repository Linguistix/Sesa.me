import type { Theme } from "./schema";

export interface ThemePreset {
  id: string;
  /** Shown in the theme picker. */
  name: string;
  theme: Theme;
}

/**
 * Applied when a page is created, and used as the silent fallback whenever a
 * stored or generated theme fails validation.
 */
export const DEFAULT_THEME: Theme = {
  palette: {
    background: "#0E0E12",
    surface: "#1A1A22",
    accent: "#6366F1",
    text_primary: "#F5F3EE",
    text_muted: "#A5A1B2",
  },
  typography: { display_font: "Sora", body_font: "Inter", weight: "medium" },
  button_style: { shape: "rounded", shadow: false, border: false, fill: "solid" },
  layout: "centered",
  background_effect: { kind: "none", angle: 160 },
  avatar_shape: "circle",
  mood_tags: ["modern", "dark"],
};

/**
 * Hand-built presets. Every one of these passes the same WCAG audit the AI
 * engine's output has to pass — `presets.test.ts` enforces that.
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "midnight",
    name: "Midnight",
    theme: DEFAULT_THEME,
  },
  {
    id: "ivory",
    name: "Ivory",
    theme: {
      palette: {
        background: "#FBFAF7",
        surface: "#FFFFFF",
        accent: "#1F1D1A",
        text_primary: "#1F1D1A",
        text_muted: "#6B6862",
      },
      typography: { display_font: "Playfair Display", body_font: "Inter", weight: "regular" },
      button_style: { shape: "pill", shadow: false, border: true, fill: "outline" },
      layout: "centered",
      background_effect: { kind: "none", angle: 160 },
      avatar_shape: "circle",
      mood_tags: ["minimal", "editorial", "light"],
    },
  },
  {
    id: "gold-noir",
    name: "Gold Noir",
    theme: {
      palette: {
        background: "#0E0E12",
        surface: "#1A1A22",
        accent: "#C9A44C",
        text_primary: "#F5F3EE",
        text_muted: "#A8A395",
      },
      typography: { display_font: "Cormorant Garamond", body_font: "Karla", weight: "medium" },
      button_style: { shape: "pill", shadow: false, border: true, fill: "outline" },
      layout: "centered",
      background_effect: { kind: "radial", secondary: "#1C1710", angle: 180 },
      avatar_shape: "circle",
      mood_tags: ["elegant", "gold", "luxury"],
    },
  },
  {
    id: "neon",
    name: "Neon",
    theme: {
      palette: {
        background: "#0B0616",
        surface: "#180F2E",
        accent: "#B14BFF",
        text_primary: "#F4ECFF",
        text_muted: "#B0A2CC",
      },
      typography: { display_font: "Space Grotesk", body_font: "Space Grotesk", weight: "bold" },
      button_style: { shape: "rounded", shadow: true, border: false, fill: "solid" },
      layout: "centered",
      background_effect: { kind: "gradient", secondary: "#2A0F4D", angle: 165 },
      avatar_shape: "rounded",
      mood_tags: ["neon", "night", "bold"],
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    theme: {
      palette: {
        background: "#1B0F1A",
        surface: "#2B1626",
        accent: "#FF7A59",
        text_primary: "#FFF3EC",
        text_muted: "#C9A79C",
      },
      typography: { display_font: "Outfit", body_font: "Outfit", weight: "medium" },
      button_style: { shape: "pill", shadow: true, border: false, fill: "solid" },
      layout: "centered",
      background_effect: { kind: "gradient", secondary: "#4A1B2E", angle: 150 },
      avatar_shape: "circle",
      mood_tags: ["warm", "sunset", "vibrant"],
    },
  },
  {
    id: "forest",
    name: "Forest",
    theme: {
      palette: {
        background: "#0F1A14",
        surface: "#17251D",
        accent: "#4ADE80",
        text_primary: "#ECFDF3",
        text_muted: "#9DB8A8",
      },
      typography: { display_font: "Fraunces", body_font: "Work Sans", weight: "regular" },
      button_style: { shape: "rounded", shadow: false, border: true, fill: "outline" },
      layout: "centered",
      background_effect: { kind: "none", angle: 160 },
      avatar_shape: "circle",
      mood_tags: ["natural", "calm", "green"],
    },
  },
  {
    id: "paper",
    name: "Paper",
    theme: {
      palette: {
        background: "#F4F1EA",
        surface: "#FFFDF8",
        accent: "#8B5E34",
        text_primary: "#2A241C",
        text_muted: "#6E6555",
      },
      typography: { display_font: "Lora", body_font: "Lato", weight: "regular" },
      button_style: { shape: "square", shadow: false, border: true, fill: "outline" },
      layout: "left",
      background_effect: { kind: "none", angle: 160 },
      avatar_shape: "rounded",
      mood_tags: ["warm", "print", "classic"],
    },
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    theme: {
      palette: {
        background: "#FFF1F6",
        surface: "#FFFFFF",
        accent: "#C2185B",
        text_primary: "#3A1024",
        text_muted: "#7A4B60",
      },
      typography: { display_font: "Poppins", body_font: "Nunito", weight: "bold" },
      button_style: { shape: "pill", shadow: true, border: false, fill: "solid" },
      layout: "centered",
      background_effect: { kind: "gradient", secondary: "#FFE3EF", angle: 170 },
      avatar_shape: "circle",
      mood_tags: ["playful", "pink", "soft"],
    },
  },
  {
    id: "brutalist",
    name: "Brutalist",
    theme: {
      palette: {
        background: "#FFFFFF",
        surface: "#FFFF00",
        accent: "#000000",
        text_primary: "#000000",
        text_muted: "#4A4A4A",
      },
      typography: { display_font: "Archivo", body_font: "Archivo", weight: "bold" },
      button_style: { shape: "square", shadow: true, border: true, fill: "outline" },
      layout: "left",
      background_effect: { kind: "none", angle: 160 },
      avatar_shape: "square",
      mood_tags: ["brutalist", "loud", "graphic"],
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    theme: {
      palette: {
        background: "#07172B",
        surface: "#0E2540",
        accent: "#38BDF8",
        text_primary: "#E8F4FF",
        text_muted: "#94B2CC",
      },
      typography: { display_font: "Manrope", body_font: "Manrope", weight: "medium" },
      button_style: { shape: "rounded", shadow: false, border: false, fill: "glass" },
      layout: "centered",
      background_effect: { kind: "gradient", secondary: "#0B3A5C", angle: 160 },
      avatar_shape: "circle",
      mood_tags: ["cool", "deep", "calm"],
    },
  },
  {
    id: "mono",
    name: "Mono",
    theme: {
      palette: {
        background: "#111111",
        surface: "#1C1C1C",
        accent: "#E5E5E5",
        text_primary: "#FAFAFA",
        text_muted: "#A3A3A3",
      },
      typography: { display_font: "JetBrains Mono", body_font: "JetBrains Mono", weight: "regular" },
      button_style: { shape: "square", shadow: false, border: true, fill: "outline" },
      layout: "left",
      background_effect: { kind: "none", angle: 160 },
      avatar_shape: "square",
      mood_tags: ["technical", "mono", "dark"],
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    theme: {
      palette: {
        background: "#F6F3FF",
        surface: "#FFFFFF",
        accent: "#5B3FBF",
        text_primary: "#241C3D",
        text_muted: "#6B6188",
      },
      typography: { display_font: "DM Serif Display", body_font: "DM Sans", weight: "regular" },
      button_style: { shape: "rounded", shadow: false, border: true, fill: "outline" },
      layout: "centered",
      background_effect: { kind: "gradient", secondary: "#EDE6FF", angle: 175 },
      avatar_shape: "circle",
      mood_tags: ["soft", "calm", "pastel"],
    },
  },
];

export function findPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
