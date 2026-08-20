import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the invalidation that a plan change depends on.
 *
 * `User.plan` drives the public page's branding footer and verified badge. An
 * upgrade that only lands in the database leaves the cached page untouched, so
 * a user who has just paid keeps seeing "Propulsé par Sesame" until the entry
 * expires. That is the bug this test exists to catch.
 */

const invalidatePublicPage = vi.fn();
const findMany = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: { findMany: (...args: unknown[]) => findMany(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
    subscription: { upsert: vi.fn() },
    user: { update: vi.fn() },
  },
}));

vi.mock("@/server/pages", () => ({
  invalidatePublicPage: (...args: unknown[]) => invalidatePublicPage(...args),
}));

beforeEach(() => {
  invalidatePublicPage.mockReset();
  findMany.mockReset().mockResolvedValue([{ slug: "camille" }, { slug: "camille-pro" }]);
  transaction.mockReset().mockResolvedValue([]);
});

describe("applySubscriptionState", () => {
  it("invalidates every page the user owns", async () => {
    const { applySubscriptionState } = await import("@/server/billing");

    await applySubscriptionState({
      userId: "user_1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    });

    expect(invalidatePublicPage).toHaveBeenCalledTimes(2);
    expect(invalidatePublicPage).toHaveBeenCalledWith("camille");
    expect(invalidatePublicPage).toHaveBeenCalledWith("camille-pro");
  });

  it("invalidates on downgrade too — branding must come back", async () => {
    const { applySubscriptionState } = await import("@/server/billing");

    await applySubscriptionState({
      userId: "user_1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "CANCELED",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: true,
    });

    expect(invalidatePublicPage).toHaveBeenCalledWith("camille");
  });

  it("reads the slugs before writing, so a rename cannot orphan the entry", async () => {
    const { applySubscriptionState } = await import("@/server/billing");

    await applySubscriptionState({
      userId: "user_1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      select: { slug: true },
    });
  });
});
