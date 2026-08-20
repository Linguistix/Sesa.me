import { DESIGN_EFFORT, DESIGN_MODEL, getAnthropic } from "./client";
import { systemPrompt, themeJsonSchema, userPrompt } from "./prompt";
import { sanitizeTheme, type ContrastFix } from "@/lib/theme/sanitize";
import { DEFAULT_THEME } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/schema";

export interface DesignResult {
  theme: Theme;
  /** Contrast corrections applied after generation, for display to the user. */
  fixes: ContrastFix[];
  /** True when the model's output failed validation and the default was used. */
  usedFallback: boolean;
  /** Raw model output, kept for the prompt-tuning log. */
  raw: string | null;
  inputTokens: number;
  outputTokens: number;
}

export class AiUnavailableError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured.");
    this.name = "AiUnavailableError";
  }
}

/**
 * Turns a natural-language description into a validated, accessible theme.
 *
 * The guarantee chain, in order, is what makes this safe to apply directly to
 * a live page:
 *
 *   1. The model is asked for structured output matching a JSON Schema, so it
 *      returns a theme object rather than prose or CSS.
 *   2. `sanitizeTheme` re-parses that output with Zod. Anything malformed —
 *      a bad hex value, a font outside the allow-list, a missing key — falls
 *      back to the default theme rather than rendering a broken page.
 *   3. Every critical colour pair is recomputed against WCAG AA and corrected
 *      if it falls short. The model's accessibility promises are never taken
 *      on trust.
 *
 * Nothing the model produces is ever executed or injected as markup; the
 * renderer only reads named fields off a validated object.
 */
export async function generateTheme(description: string): Promise<DesignResult> {
  const client = getAnthropic();
  if (!client) throw new AiUnavailableError();

  const response = await client.messages.create({
    model: DESIGN_MODEL,
    max_tokens: 4096,
    output_config: {
      effort: DESIGN_EFFORT,
      format: {
        type: "json_schema",
        schema: themeJsonSchema(),
      },
    },
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt(description) }],
  });

  const raw = extractText(response.content);

  // A refusal or an empty turn is not an error — it just means we fall back.
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  const { theme, fixes, usedFallback } = sanitizeTheme(parsed);

  return {
    theme,
    fixes,
    usedFallback,
    raw,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/** Concatenates the text blocks of a response, ignoring thinking blocks. */
function extractText(content: Array<{ type: string; text?: string }>): string | null {
  const text = content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("")
    .trim();

  return text.length > 0 ? text : null;
}

/** The default, for callers that need a theme when generation is unavailable. */
export function fallbackTheme(): Theme {
  return DEFAULT_THEME;
}
