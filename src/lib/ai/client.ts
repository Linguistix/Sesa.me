import Anthropic from "@anthropic-ai/sdk";

/**
 * The design engine is optional at build and dev time.
 *
 * Without an API key the AI features report themselves as unavailable and the
 * rest of the app — including the manual theme editor — works unchanged.
 * Returning null beats throwing at import time, which would break every page.
 */
let cached: Anthropic | null | undefined;

export function getAnthropic(): Anthropic | null {
  if (cached !== undefined) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    cached = null;
    return cached;
  }

  /*
    An identity-linked API key is scoped to a person rather than to one
    workspace, so the API cannot infer which workspace a request bills and
    audits against: every endpoint returns 400 until the id is sent. Ordinary
    keys carry their workspace already and ignore the header, so setting it
    unconditionally when present is safe for both kinds.
  */
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();

  cached = new Anthropic({
    apiKey,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
  return cached;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Theme generation is a constrained mapping task, not open-ended reasoning:
 * the schema does most of the work. Low effort keeps latency in the range
 * where an instant preview still feels instant, and keeps the per-generation
 * cost low enough to give away three a month on the free plan.
 */
export const DESIGN_MODEL = "claude-opus-5";
export const DESIGN_EFFORT = "low" as const;

/** Summaries are one or two sentences over pre-computed numbers. */
export const SUMMARY_MODEL = "claude-opus-5";
export const SUMMARY_EFFORT = "low" as const;
