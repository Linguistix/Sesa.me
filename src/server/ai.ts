import "server-only";
import { prisma } from "@/lib/db";
import { limitsFor } from "@/lib/plans";
import { aiLimiter } from "@/lib/rate-limit";
import { generateTheme, AiUnavailableError, type DesignResult } from "@/lib/ai/design";
import { summarizeWeek, type WeeklySummaryInput } from "@/lib/ai/summary";
import type { Plan } from "@/generated/prisma/enums";

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  /** First instant of the next calendar month, when the quota resets. */
  resetsAt: Date;
}

/** Start of the current calendar month, in UTC. */
function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthEnd(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * How many theme generations the user has left this month.
 *
 * Counts only THEME rows: the weekly analytics summary is generated on the
 * platform's initiative, not the user's, so charging it against their quota
 * would be surprising.
 */
export async function themeQuota(userId: string, plan: Plan): Promise<QuotaState> {
  const limit = limitsFor(plan).aiGenerationsPerMonth;

  if (limit === Number.POSITIVE_INFINITY) {
    return { used: 0, limit, remaining: limit, resetsAt: monthEnd() };
  }

  const used = await prisma.aiGeneration.count({
    where: { userId, kind: "THEME", createdAt: { gte: monthStart() } },
  });

  return { used, limit, remaining: Math.max(0, limit - used), resetsAt: monthEnd() };
}

export type GenerateOutcome =
  | { ok: true; result: DesignResult; quota: QuotaState }
  | { ok: false; reason: "quota"; quota: QuotaState }
  | { ok: false; reason: "burst"; retryAt: Date }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "failed" };

/**
 * Generates a theme for a user, enforcing their monthly quota.
 *
 * The quota is checked before the call and the log row is written after it —
 * including when the call fails, so a burst of failing requests still costs
 * the user quota. Without that, a failure loop would be free to the caller
 * and expensive to us.
 */
export async function generateThemeForUser(
  userId: string,
  plan: Plan,
  description: string,
): Promise<GenerateOutcome> {
  // The burst guard sits in front of the monthly quota. Pro is unlimited by
  // the month, which is exactly why it still needs a per-minute ceiling: a
  // stuck client retrying in a loop would otherwise bill indefinitely.
  const burst = await aiLimiter.check(userId);
  if (!burst.ok) return { ok: false, reason: "burst", retryAt: new Date(burst.resetAt) };

  const quota = await themeQuota(userId, plan);
  if (quota.remaining <= 0) return { ok: false, reason: "quota", quota };

  try {
    const result = await generateTheme(description);

    await prisma.aiGeneration.create({
      data: {
        userId,
        kind: "THEME",
        prompt: description,
        output: result.raw,
        usedFallback: result.usedFallback,
        fixesApplied: result.fixes.length,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    return { ok: true, result, quota: await themeQuota(userId, plan) };
  } catch (error) {
    if (error instanceof AiUnavailableError) return { ok: false, reason: "unavailable" };

    await prisma.aiGeneration.create({
      data: {
        userId,
        kind: "THEME",
        prompt: description,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    console.error("[ai] theme generation failed", error);
    return { ok: false, reason: "failed" };
  }
}

/**
 * Produces the natural-language weekly summary.
 *
 * The figures are computed by the analytics pipeline and passed in; the model
 * only phrases them. Nothing here asks it to do arithmetic.
 */
export async function weeklySummaryForUser(
  userId: string,
  input: WeeklySummaryInput,
): Promise<string | null> {
  try {
    const summary = await summarizeWeek(input);
    if (!summary) return null;

    await prisma.aiGeneration.create({
      data: {
        userId,
        kind: "ANALYTICS_SUMMARY",
        prompt: JSON.stringify(input),
        output: summary.text,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
      },
    });

    return summary.text;
  } catch (error) {
    // A missing summary degrades the dashboard gracefully; the numbers above
    // it are the real content.
    console.error("[ai] weekly summary failed", error);
    return null;
  }
}
