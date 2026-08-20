import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, can, limitsFor } from "../plans";

describe("plan limits", () => {
  it("defines every plan the schema can produce", () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual(["FREE", "PRO"]);
  });

  it("gates the paid capabilities behind Pro", () => {
    for (const capability of [
      "canRemoveBranding",
      "canUseCustomDomain",
      "canExportCsv",
      "canUseAnimatedAvatar",
      "verifiedBadge",
    ] as const) {
      expect(can("FREE", capability)).toBe(false);
      expect(can("PRO", capability)).toBe(true);
    }
  });

  it("limits free AI generations but not Pro", () => {
    expect(limitsFor("FREE").aiGenerationsPerMonth).toBe(3);
    expect(limitsFor("PRO").aiGenerationsPerMonth).toBe(Number.POSITIVE_INFINITY);
  });

  it("gives Pro a longer analytics window", () => {
    expect(limitsFor("PRO").analyticsRetentionDays).toBeGreaterThan(
      limitsFor("FREE").analyticsRetentionDays,
    );
  });
});
