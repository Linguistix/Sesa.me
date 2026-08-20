import "server-only";
import { prisma } from "@/lib/db";
import { generateCode } from "@/lib/shortcode";
import { isSafeHttpUrl } from "@/lib/links";

/**
 * Creates (or reuses) a short link.
 *
 * One short link per underlying page link: handing out a second code for the
 * same destination would split its statistics across two rows for no benefit.
 */
export async function createShortLink(params: {
  pageId: string;
  userId: string;
  linkId?: string | null;
  targetUrl: string;
}) {
  const page = await prisma.page.findFirst({
    where: { id: params.pageId, userId: params.userId },
    select: { id: true },
  });
  if (!page) return null;

  if (!isSafeHttpUrl(params.targetUrl)) return null;

  if (params.linkId) {
    const existing = await prisma.shortLink.findFirst({
      where: { pageId: params.pageId, linkId: params.linkId },
    });
    if (existing) return existing;
  }

  // Codes are random, so a collision is possible but vanishingly rare;
  // retrying on the unique constraint is cheaper than pre-checking.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.shortLink.create({
        data: {
          code: generateCode(),
          pageId: params.pageId,
          linkId: params.linkId ?? null,
          targetUrl: params.targetUrl,
        },
      });
    } catch {
      if (attempt === 4) throw new Error("Impossible de générer un code unique.");
    }
  }

  return null;
}

export async function resolveShortLink(code: string) {
  return prisma.shortLink.findUnique({
    where: { code },
    select: { id: true, pageId: true, linkId: true, targetUrl: true },
  });
}

export async function listShortLinks(pageId: string) {
  const shortLinks = await prisma.shortLink.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    include: { link: { select: { title: true } } },
  });

  if (shortLinks.length === 0) return [];

  // One grouped query for all click counts rather than a query per row.
  const clickCounts = await prisma.analyticsEvent.groupBy({
    by: ["linkId"],
    where: {
      pageId,
      type: "LINK_CLICK",
      linkId: { in: shortLinks.map((s) => s.linkId).filter((id): id is string => id !== null) },
    },
    _count: { _all: true },
  });

  const clicksByLink = new Map(clickCounts.map((c) => [c.linkId, c._count._all]));

  return shortLinks.map((s) => ({
    id: s.id,
    code: s.code,
    targetUrl: s.targetUrl,
    linkId: s.linkId,
    title: s.link?.title ?? "Lien direct",
    clicks: s.linkId ? (clicksByLink.get(s.linkId) ?? 0) : 0,
    createdAt: s.createdAt,
  }));
}

export async function deleteShortLink(id: string, userId: string) {
  const result = await prisma.shortLink.deleteMany({
    where: { id, page: { userId } },
  });
  return result.count === 1;
}
