import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Erasure has to reach the caches, not just the database.
 *
 * The bug this guards: deleting an account emptied every table but left the
 * cached page serving 200 for the rest of its TTL. For a right-to-erasure
 * request, "gone in under a minute" is not the same as gone.
 */

const findMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    page: { findMany: (...args: unknown[]) => findMany(...args) },
    user: { deleteMany: (...args: unknown[]) => deleteMany(...args) },
    analyticsEvent: { groupBy: vi.fn() },
  },
}));

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([{ slug: "camille" }, { slug: "camille-alt" }]);
  deleteMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("deleteUserAccount", () => {
  it("returns the freed slugs so the caller can drop their cached copies", async () => {
    const { deleteUserAccount } = await import("@/server/gdpr");

    const freed = await deleteUserAccount("user_1");
    expect(freed).toEqual(["camille", "camille-alt"]);
  });

  it("reads the slugs before the delete, while the rows still exist", async () => {
    const { deleteUserAccount } = await import("@/server/gdpr");

    const order: string[] = [];
    findMany.mockImplementation(async () => {
      order.push("read");
      return [{ slug: "camille" }];
    });
    deleteMany.mockImplementation(async () => {
      order.push("delete");
      return { count: 1 };
    });

    await deleteUserAccount("user_1");

    // Reading after the cascade would return nothing and silently leave the
    // page cached.
    expect(order).toEqual(["read", "delete"]);
  });

  it("returns null when nothing was deleted, so the caller does not report success", async () => {
    const { deleteUserAccount } = await import("@/server/gdpr");
    deleteMany.mockResolvedValue({ count: 0 });

    expect(await deleteUserAccount("nobody")).toBeNull();
  });

  it("scopes the delete to the requesting user", async () => {
    const { deleteUserAccount } = await import("@/server/gdpr");

    await deleteUserAccount("user_1");
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "user_1" } });
  });
});
