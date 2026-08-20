import "server-only";
import { prisma } from "@/lib/db";

/**
 * GDPR data portability: everything held about one user, in one JSON document.
 *
 * Analytics events are included as aggregates rather than rows. They are not
 * the requesting user's personal data — they describe their *visitors*, and
 * exporting per-visitor rows would hand one person a log of others' behaviour.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      pages: { include: { links: { orderBy: { position: "asc" } }, shortLinks: true } },
      subscription: true,
      accounts: { select: { provider: true, type: true } },
    },
  });

  if (!user) return null;

  const pageIds = user.pages.map((p) => p.id);
  const eventTotals = await prisma.analyticsEvent.groupBy({
    by: ["pageId", "type"],
    where: { pageId: { in: pageIds } },
    _count: { _all: true },
  });

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      locale: user.locale,
      createdAt: user.createdAt,
    },
    // Never exported: passwordHash, OAuth tokens, and per-visitor analytics.
    connectedAccounts: user.accounts,
    subscription: user.subscription
      ? {
          status: user.subscription.status,
          plan: user.subscription.plan,
          currentPeriodEnd: user.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
        }
      : null,
    pages: user.pages.map((page) => ({
      slug: page.slug,
      displayName: page.displayName,
      bio: page.bio,
      avatarUrl: page.avatarUrl,
      theme: page.themeJson,
      isPublished: page.isPublished,
      createdAt: page.createdAt,
      links: page.links.map((link) => ({
        type: link.type,
        title: link.title,
        url: link.url,
        emoji: link.emoji,
        body: link.body,
        position: link.position,
        isActive: link.isActive,
        isPasswordProtected: link.passwordHash !== null,
      })),
      shortLinks: page.shortLinks.map((s) => ({
        code: s.code,
        targetUrl: s.targetUrl,
        createdAt: s.createdAt,
      })),
      analyticsTotals: eventTotals
        .filter((e) => e.pageId === page.id)
        .map((e) => ({ type: e.type, count: e._count._all })),
    })),
  };
}

/**
 * GDPR erasure.
 *
 * Every related table cascades from `User` in the schema, so deleting the user
 * row removes pages, links, short links, analytics events, sessions and the
 * subscription mirror in one statement. The Stripe customer is deliberately
 * *not* deleted here — invoices are records the business is required to keep —
 * so the caller should cancel the subscription first.
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  const result = await prisma.user.deleteMany({ where: { id: userId } });
  return result.count === 1;
}
