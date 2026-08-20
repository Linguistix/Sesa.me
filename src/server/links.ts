import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { LinkInput } from "@/lib/links";
import { LinkType } from "@/generated/prisma/enums";

/**
 * Blocks are ordered by a dense integer `position`. Reordering rewrites the
 * whole list in one transaction rather than patching individual rows, which
 * keeps positions gap-free and makes drag-and-drop idempotent.
 */

export { linkInputSchema, isSafeHttpUrl, type LinkInput } from "@/lib/links";

export async function listLinks(pageId: string) {
  return prisma.link.findMany({ where: { pageId }, orderBy: { position: "asc" } });
}

/** Confirms the page belongs to the user before any write touches its blocks. */
async function assertPageOwnership(pageId: string, userId: string): Promise<boolean> {
  const page = await prisma.page.findFirst({ where: { id: pageId, userId }, select: { id: true } });
  return page !== null;
}

export async function createLink(pageId: string, userId: string, input: LinkInput) {
  if (!(await assertPageOwnership(pageId, userId))) return null;

  const last = await prisma.link.findFirst({
    where: { pageId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return prisma.link.create({
    data: {
      pageId,
      type: input.type as LinkType,
      title: input.title,
      url: input.url || null,
      emoji: input.emoji || null,
      body: input.body || null,
      images: input.images,
      isActive: input.isActive,
      syncProvider: input.syncProvider ?? null,
      position: (last?.position ?? -1) + 1,
      passwordHash: input.password ? await bcrypt.hash(input.password, 10) : null,
    },
  });
}

export async function updateLink(linkId: string, userId: string, input: LinkInput) {
  const link = await prisma.link.findFirst({
    where: { id: linkId, page: { userId } },
    select: { id: true },
  });
  if (!link) return false;

  // `undefined` leaves the existing gate alone; an empty string removes it.
  const passwordHash =
    input.password === undefined
      ? undefined
      : input.password === ""
        ? null
        : await bcrypt.hash(input.password, 10);

  await prisma.link.update({
    where: { id: linkId },
    data: {
      type: input.type as LinkType,
      title: input.title,
      url: input.url || null,
      emoji: input.emoji || null,
      body: input.body || null,
      images: input.images,
      isActive: input.isActive,
      syncProvider: input.syncProvider ?? null,
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    },
  });
  return true;
}

export async function deleteLink(linkId: string, userId: string) {
  const result = await prisma.link.deleteMany({ where: { id: linkId, page: { userId } } });
  return result.count === 1;
}

/**
 * Rewrites positions to match `orderedIds`.
 *
 * Ids that do not belong to the page are dropped, and any block the caller
 * omitted keeps its relative order at the end — a stale browser tab cannot
 * delete or orphan a block by posting an incomplete list.
 */
export async function reorderLinks(pageId: string, userId: string, orderedIds: string[]) {
  if (!(await assertPageOwnership(pageId, userId))) return false;

  const existing = await prisma.link.findMany({
    where: { pageId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const existingIds = new Set(existing.map((l) => l.id));
  const requested = orderedIds.filter((id) => existingIds.has(id));
  const requestedSet = new Set(requested);
  const remainder = existing.map((l) => l.id).filter((id) => !requestedSet.has(id));
  const finalOrder = [...requested, ...remainder];

  await prisma.$transaction(
    finalOrder.map((id, index) =>
      prisma.link.update({ where: { id }, data: { position: index } }),
    ),
  );
  return true;
}

/** Verifies a visitor's password against a gated link and returns its destination. */
export async function unlockLink(linkId: string, password: string) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: { url: true, passwordHash: true, isActive: true },
  });

  if (!link || !link.isActive || !link.passwordHash || !link.url) return null;
  const ok = await bcrypt.compare(password, link.passwordHash);
  return ok ? link.url : null;
}
