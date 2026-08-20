import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hostnameSchema, TXT_RECORD_NAME } from "@/lib/domains";
import { can } from "@/lib/plans";
import type { Plan } from "@/generated/prisma/enums";

export { hostnameSchema, TXT_RECORD_NAME } from "@/lib/domains";

export type AttachResult =
  | { ok: true; hostname: string; token: string }
  | { ok: false; error: string };

/**
 * Registers a custom domain, unverified.
 *
 * Verification is a separate, deliberate step: accepting a hostname on trust
 * would let anyone claim a domain they do not control and, on a platform that
 * routes by Host header, intercept its traffic.
 */
export async function attachDomain(
  pageId: string,
  userId: string,
  plan: Plan,
  rawHostname: string,
): Promise<AttachResult> {
  if (!can(plan, "canUseCustomDomain")) {
    return { ok: false, error: "Le domaine personnalisé est réservé au plan Pro." };
  }

  const parsed = hostnameSchema.safeParse(rawHostname);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const page = await prisma.page.findFirst({
    where: { id: pageId, userId },
    select: { id: true },
  });
  if (!page) return { ok: false, error: "Page introuvable." };

  const taken = await prisma.customDomain.findUnique({
    where: { hostname: parsed.data },
    select: { pageId: true },
  });
  if (taken && taken.pageId !== pageId) {
    return { ok: false, error: "Ce domaine est déjà utilisé." };
  }

  const token = randomBytes(16).toString("hex");

  const domain = await prisma.customDomain.upsert({
    where: { pageId },
    create: { pageId, hostname: parsed.data, verificationToken: token },
    // Changing the hostname resets verification — proof of one domain is not
    // proof of another.
    update: { hostname: parsed.data, verificationToken: token, verifiedAt: null },
  });

  return { ok: true, hostname: domain.hostname, token: domain.verificationToken };
}

/**
 * Checks the DNS TXT record that proves control of the domain.
 *
 * Uses `node:dns` rather than a DNS-over-HTTPS provider so the lookup follows
 * the deployment's own resolver.
 */
export async function verifyDomain(pageId: string, userId: string): Promise<boolean> {
  const domain = await prisma.customDomain.findFirst({
    where: { pageId, page: { userId } },
  });
  if (!domain) return false;

  const { resolveTxt } = await import("node:dns/promises");

  try {
    const records = await resolveTxt(`${TXT_RECORD_NAME}.${domain.hostname}`);
    // resolveTxt returns chunked strings per record; join before comparing.
    const values = records.map((chunks) => chunks.join(""));
    if (!values.includes(domain.verificationToken)) return false;
  } catch {
    // NXDOMAIN or a resolver failure both mean "not proven yet".
    return false;
  }

  await prisma.customDomain.update({
    where: { id: domain.id },
    data: { verifiedAt: new Date() },
  });
  return true;
}

export async function getDomain(pageId: string) {
  return prisma.customDomain.findUnique({ where: { pageId } });
}

export async function detachDomain(pageId: string, userId: string) {
  const result = await prisma.customDomain.deleteMany({
    where: { pageId, page: { userId } },
  });
  return result.count === 1;
}

/** Resolves an incoming Host header to a page slug, for domain-based routing. */
export async function slugForHostname(hostname: string): Promise<string | null> {
  const parsed = hostnameSchema.safeParse(hostname);
  if (!parsed.success) return null;

  const domain = await prisma.customDomain.findUnique({
    where: { hostname: parsed.data },
    select: { verifiedAt: true, page: { select: { slug: true } } },
  });

  // An unverified domain must not serve a page: that is the whole point of
  // verification.
  if (!domain?.verifiedAt) return null;
  return domain.page.slug;
}
