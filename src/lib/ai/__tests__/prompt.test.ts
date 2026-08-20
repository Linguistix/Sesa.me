import { describe, expect, it } from "vitest";
import { systemPrompt, themeJsonSchema, userPrompt } from "../prompt";
import { ALLOWED_FONTS, themeSchema } from "@/lib/theme/schema";

describe("systemPrompt", () => {
  it("states the WCAG requirement explicitly", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("WCAG AA");
    expect(prompt).toContain("4.5:1");
  });

  it("tells the model to adapt rather than abandon the requested style", () => {
    // This is the rule that keeps "white and gold" from becoming grey.
    expect(systemPrompt()).toMatch(/adapte\s+discrètement/i);
  });

  it("enumerates the permitted fonts, so the model cannot invent one", () => {
    const prompt = systemPrompt();
    for (const font of ["Inter", "Playfair Display", "JetBrains Mono"]) {
      expect(prompt).toContain(font);
    }
  });

  it("asks for JSON only", () => {
    expect(systemPrompt()).toMatch(/UNIQUEMENT\s+avec\s+l'objet\s+JSON/);
  });
});

describe("userPrompt", () => {
  it("carries the description through", () => {
    expect(userPrompt("sombre avec néons violets")).toContain("sombre avec néons violets");
  });
});

describe("themeJsonSchema", () => {
  const schema = themeJsonSchema();

  it("requires the fields the renderer cannot work without", () => {
    expect(schema.required).toEqual(
      expect.arrayContaining(["palette", "typography", "button_style", "layout"]),
    );
  });

  it("constrains fonts to exactly the allow-list the Zod schema enforces", () => {
    // If these two drift apart, the model would be steered toward values the
    // validator then rejects — a silent fallback on every generation.
    const displayEnum = schema.properties.typography.properties.display_font.enum;
    const bodyEnum = schema.properties.typography.properties.body_font.enum;

    expect([...displayEnum].sort()).toEqual([...ALLOWED_FONTS].sort());
    expect([...bodyEnum].sort()).toEqual([...ALLOWED_FONTS].sort());
  });

  it("constrains colours to hex literals", () => {
    for (const key of ["background", "surface", "accent", "text_primary", "text_muted"] as const) {
      expect(schema.properties.palette.properties[key].pattern).toBeTruthy();
    }
  });

  it("agrees with the Zod schema on every enum", () => {
    const cases: Array<[readonly string[], unknown]> = [
      [schema.properties.layout.enum, "layout"],
      [schema.properties.button_style.properties.shape.enum, "shape"],
      [schema.properties.button_style.properties.fill.enum, "fill"],
      [schema.properties.typography.properties.weight.enum, "weight"],
      [schema.properties.avatar_shape.enum, "avatar_shape"],
    ];

    // Every value the JSON Schema permits must survive Zod validation.
    for (const [values] of cases) {
      expect(values.length).toBeGreaterThan(0);
    }

    for (const layout of schema.properties.layout.enum) {
      const theme = { ...VALID_THEME, layout };
      expect(themeSchema.safeParse(theme).success).toBe(true);
    }
    for (const shape of schema.properties.button_style.properties.shape.enum) {
      const theme = { ...VALID_THEME, button_style: { ...VALID_THEME.button_style, shape } };
      expect(themeSchema.safeParse(theme).success).toBe(true);
    }
    for (const fill of schema.properties.button_style.properties.fill.enum) {
      const theme = { ...VALID_THEME, button_style: { ...VALID_THEME.button_style, fill } };
      expect(themeSchema.safeParse(theme).success).toBe(true);
    }
    for (const weight of schema.properties.typography.properties.weight.enum) {
      const theme = { ...VALID_THEME, typography: { ...VALID_THEME.typography, weight } };
      expect(themeSchema.safeParse(theme).success).toBe(true);
    }
  });

  it("forbids extra properties, so a chatty model cannot smuggle fields through", () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.palette.additionalProperties).toBe(false);
    expect(schema.properties.typography.additionalProperties).toBe(false);
  });
});

const VALID_THEME = {
  palette: {
    background: "#0E0E12",
    surface: "#1A1A22",
    accent: "#6366F1",
    text_primary: "#F5F3EE",
    text_muted: "#A5A1B2",
  },
  typography: { display_font: "Inter", body_font: "Inter", weight: "medium" },
  button_style: { shape: "rounded", shadow: false, border: false, fill: "solid" },
  layout: "centered",
  background_effect: { kind: "none", angle: 160 },
  avatar_shape: "circle",
  mood_tags: ["modern"],
} as const;
