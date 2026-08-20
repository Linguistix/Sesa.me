import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME } from "@/lib/theme/presets";
import { auditContrast } from "@/lib/theme/sanitize";

/**
 * Exercises the full generation path with a stubbed API client.
 *
 * The point is to test the chain we own — request shape, parsing, validation,
 * contrast repair — not the model's taste.
 */

const create = vi.fn();

vi.mock("../client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client")>();
  return {
    ...actual,
    getAnthropic: () => ({ messages: { create } }),
    isAiConfigured: () => true,
  };
});

function apiResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 500, output_tokens: 120 },
  };
}

const GOOD_THEME = {
  palette: {
    background: "#0E0E12",
    surface: "#1A1A22",
    accent: "#C9A44C",
    text_primary: "#F5F3EE",
    text_muted: "#A8A395",
  },
  typography: { display_font: "Playfair Display", body_font: "Inter", weight: "medium" },
  button_style: { shape: "pill", shadow: false, border: true, fill: "outline" },
  layout: "centered",
  background_effect: { kind: "none", angle: 160 },
  avatar_shape: "circle",
  mood_tags: ["minimal", "gold"],
};

beforeEach(() => create.mockReset());
afterEach(() => vi.clearAllMocks());

describe("generateTheme", () => {
  it("asks for structured output against the theme schema", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue(apiResponse(JSON.stringify(GOOD_THEME)));

    await generateTheme("minimaliste blanc et doré");

    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0]![0];

    expect(request.model).toBe("claude-opus-5");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.output_config.format.schema.properties.palette).toBeTruthy();
    expect(request.system).toContain("WCAG AA");
    expect(request.messages[0].content).toContain("minimaliste blanc et doré");
  });

  it("returns a valid theme untouched when the model complies", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue(apiResponse(JSON.stringify(GOOD_THEME)));

    const result = await generateTheme("doré élégant");

    expect(result.usedFallback).toBe(false);
    expect(result.fixes).toEqual([]);
    expect(result.theme.palette.accent).toBe("#C9A44C");
    expect(result.inputTokens).toBe(500);
    expect(result.outputTokens).toBe(120);
  });

  it("repairs a theme the model made unreadable, and reports the repairs", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue(
      apiResponse(
        JSON.stringify({
          ...GOOD_THEME,
          palette: {
            background: "#FFFFFF",
            surface: "#FFFFFF",
            accent: "#FFF6D0",
            text_primary: "#FFFBEA",
            text_muted: "#FFF8DC",
          },
        }),
      ),
    );

    const result = await generateTheme("blanc sur blanc");

    expect(result.usedFallback).toBe(false);
    expect(result.fixes.length).toBeGreaterThan(0);
    expect(auditContrast(result.theme)).toEqual([]);
  });

  it("falls back to the default when the model returns prose", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue(apiResponse("Bien sûr ! Voici un thème sombre et élégant."));

    const result = await generateTheme("sombre");

    expect(result.usedFallback).toBe(true);
    expect(result.theme).toEqual(DEFAULT_THEME);
  });

  it("falls back when the model returns valid JSON of the wrong shape", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue(apiResponse(JSON.stringify({ colors: ["#fff", "#000"] })));

    const result = await generateTheme("noir et blanc");
    expect(result.usedFallback).toBe(true);
  });

  it("falls back when the turn contains no text at all", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue({
      content: [{ type: "thinking", thinking: "…" }],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    const result = await generateTheme("quoi que ce soit");
    expect(result.usedFallback).toBe(true);
    expect(result.raw).toBeNull();
  });

  it("ignores thinking blocks and reads only the text", async () => {
    const { generateTheme } = await import("../design");
    create.mockResolvedValue({
      content: [
        { type: "thinking", thinking: "L'utilisateur veut du doré." },
        { type: "text", text: JSON.stringify(GOOD_THEME) },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await generateTheme("doré");
    expect(result.usedFallback).toBe(false);
    expect(result.theme.palette.accent).toBe("#C9A44C");
  });

  it("keeps the raw output for the prompt-tuning log", async () => {
    const { generateTheme } = await import("../design");
    const raw = JSON.stringify(GOOD_THEME);
    create.mockResolvedValue(apiResponse(raw));

    const result = await generateTheme("doré");
    expect(result.raw).toBe(raw);
  });
});

describe("generateTheme without an API key", () => {
  it("throws a typed error the caller can turn into a clear message", async () => {
    vi.resetModules();
    vi.doMock("../client", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../client")>();
      return { ...actual, getAnthropic: () => null, isAiConfigured: () => false };
    });

    const { generateTheme, AiUnavailableError } = await import("../design");
    await expect(generateTheme("doré")).rejects.toBeInstanceOf(AiUnavailableError);

    vi.doUnmock("../client");
    vi.resetModules();
  });
});
