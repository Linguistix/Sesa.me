"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { disconnect } from "@/server/connections";
import { syncPage } from "@/server/sync";
import { getEditablePage, invalidatePublicPage } from "@/server/pages";
import { isProviderId } from "@/lib/oauth/providers";
import type { ActionState } from "./auth";

export async function disconnectAction(provider: string): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };
  if (!isProviderId(provider)) return { error: "Fournisseur inconnu." };

  await disconnect(userId, provider);

  const page = await getEditablePage(userId);
  if (page) await invalidatePublicPage(page.slug);

  revalidatePath("/dashboard/connections");
  revalidatePath("/dashboard");
  return {};
}

/** Forces a refresh of every synced block, bypassing the freshness window. */
export async function syncNowAction(): Promise<ActionState & { changed?: number }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };

  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  // Explicit request: ignore the freshness window.
  const changed = await syncPage(page.id, userId, { force: true });

  await invalidatePublicPage(page.slug);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/connections");
  revalidatePath(`/${page.slug}`);

  return { changed };
}
