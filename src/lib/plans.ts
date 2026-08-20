import type { Plan } from "@/generated/prisma/enums";

/**
 * What each plan may do.
 *
 * Every gate in the app reads from this table rather than testing
 * `plan === "PRO"` inline, so adding a tier means editing one file and the
 * limits are visible in one place.
 */
export interface PlanLimits {
  /** AI theme generations per calendar month. `Infinity` for unlimited. */
  aiGenerationsPerMonth: number;
  /** Whether the "Powered by Sesame" footer can be removed. */
  canRemoveBranding: boolean;
  canUseCustomDomain: boolean;
  canExportCsv: boolean;
  /** How far back the analytics dashboard may look. */
  analyticsRetentionDays: number;
  canUseAnimatedAvatar: boolean;
  verifiedBadge: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    aiGenerationsPerMonth: 3,
    canRemoveBranding: false,
    canUseCustomDomain: false,
    canExportCsv: false,
    analyticsRetentionDays: 30,
    canUseAnimatedAvatar: false,
    verifiedBadge: false,
  },
  PRO: {
    aiGenerationsPerMonth: Number.POSITIVE_INFINITY,
    canRemoveBranding: true,
    canUseCustomDomain: true,
    canExportCsv: true,
    analyticsRetentionDays: 365,
    canUseAnimatedAvatar: true,
    verifiedBadge: true,
  },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function can<K extends keyof PlanLimits>(plan: Plan, capability: K): PlanLimits[K] {
  return PLAN_LIMITS[plan][capability];
}
