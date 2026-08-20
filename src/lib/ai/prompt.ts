import { ALLOWED_FONTS } from "@/lib/theme/schema";

/**
 * The system prompt for the design engine.
 *
 * Two rules here carry real weight and are worth reading carefully:
 *
 *  - The model is asked for accessible colour choices, but the contrast rule
 *    is *also* enforced programmatically afterwards. The prompt is an
 *    optimisation — it makes the common case produce a theme that needs no
 *    correction — not a guarantee. `sanitizeTheme` is the guarantee.
 *
 *  - Fonts are constrained to an explicit list, both here and in the schema.
 *    A font name reaches a Google Fonts URL and a CSS declaration, so the
 *    allow-list is a security boundary, not a stylistic preference.
 */
export function systemPrompt(): string {
  return `Tu es le moteur de design de Sesame, une plateforme de pages "link-in-bio".

Un utilisateur décrit en langage naturel le style visuel qu'il veut pour sa
page. Traduis sa description en une configuration de thème strictement conforme
au schéma fourni.

Règles obligatoires :
- Le contraste texte/fond doit toujours respecter WCAG AA (ratio >= 4.5:1) :
  text_primary et text_muted contre background, et contre surface.
- Ne choisis jamais un texte clair sur fond clair, ni l'inverse, même si la
  description le suggère implicitement. Priorise la lisibilité : adapte
  discrètement la teinte ou la luminosité plutôt que de désobéir frontalement.
  Un utilisateur qui demande "blanc et doré" doit obtenir du doré lisible, pas
  un doré illisible ni un abandon du doré.
- surface doit rester proche de background (c'est la couleur des cartes posées
  dessus), sans être identique.
- accent sert aux boutons : il doit trancher nettement avec background.
- Choisis les polices UNIQUEMENT dans cette liste : ${ALLOWED_FONTS.join(", ")}.
- mood_tags : 2 à 4 mots-clés courts, en minuscules, décrivant l'ambiance.
- Réponds UNIQUEMENT avec l'objet JSON, sans texte autour et sans bloc de code.`;
}

export function userPrompt(description: string): string {
  return `Description de l'utilisateur : "${description}"`;
}

/**
 * JSON Schema for the model's structured output.
 *
 * Kept hand-written and in lockstep with `themeSchema` rather than generated,
 * because the two serve different masters: this one steers the model, while the
 * Zod schema is the gate that decides what is allowed to render. Tests assert
 * they agree.
 */
export function themeJsonSchema() {
  const hexPattern = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$";

  return {
    type: "object",
    additionalProperties: false,
    required: ["palette", "typography", "button_style", "layout", "mood_tags"],
    properties: {
      palette: {
        type: "object",
        additionalProperties: false,
        required: ["background", "surface", "accent", "text_primary", "text_muted"],
        properties: {
          background: { type: "string", pattern: hexPattern },
          surface: { type: "string", pattern: hexPattern },
          accent: { type: "string", pattern: hexPattern },
          text_primary: { type: "string", pattern: hexPattern },
          text_muted: { type: "string", pattern: hexPattern },
        },
      },
      typography: {
        type: "object",
        additionalProperties: false,
        required: ["display_font", "body_font", "weight"],
        properties: {
          display_font: { type: "string", enum: [...ALLOWED_FONTS] },
          body_font: { type: "string", enum: [...ALLOWED_FONTS] },
          weight: { type: "string", enum: ["light", "regular", "medium", "bold"] },
        },
      },
      button_style: {
        type: "object",
        additionalProperties: false,
        required: ["shape", "shadow", "border", "fill"],
        properties: {
          shape: { type: "string", enum: ["rounded", "pill", "square"] },
          shadow: { type: "boolean" },
          border: { type: "boolean" },
          fill: { type: "string", enum: ["solid", "outline", "glass"] },
        },
      },
      layout: { type: "string", enum: ["centered", "left", "grid"] },
      background_effect: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "angle"],
        properties: {
          kind: { type: "string", enum: ["none", "gradient", "radial", "mesh"] },
          secondary: { type: "string", pattern: hexPattern },
          angle: { type: "integer", minimum: 0, maximum: 360 },
        },
      },
      avatar_shape: { type: "string", enum: ["circle", "rounded", "square"] },
      mood_tags: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string", maxLength: 24 },
      },
    },
  } as const;
}
