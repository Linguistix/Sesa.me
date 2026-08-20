"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createCheckoutSession, createPortalSession } from "@/server/billing";
import { createShortLink, deleteShortLink } from "@/server/shortlinks";
import { getEditablePage } from "@/server/pages";
import { revalidatePath } from "next/cache";

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}

export async function startCheckoutAction() {
  const userId = await requireUserId();
  const url = await createCheckoutSession(userId);
  // No URL means billing is not configured; the page shows that state.
  if (!url) redirect("/dashboard/billing?status=unavailable");
  redirect(url);
}

export async function openPortalAction() {
  const userId = await requireUserId();
  const url = await createPortalSession(userId);
  if (!url) redirect("/dashboard/billing?status=unavailable");
  redirect(url);
}

export async function createShortLinkAction(linkId: string, targetUrl: string) {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const created = await createShortLink({ pageId: page.id, userId, linkId, targetUrl });
  if (!created) return { error: "Lien court impossible à créer." };

  revalidatePath("/dashboard/analytics");
  return {};
}

export async function deleteShortLinkAction(id: string) {
  const userId = await requireUserId();
  const ok = await deleteShortLink(id, userId);
  if (!ok) return { error: "Lien court introuvable." };

  revalidatePath("/dashboard/analytics");
  return {};
}
