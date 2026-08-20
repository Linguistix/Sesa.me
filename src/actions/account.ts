"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/lib/auth";
import { deleteUserAccount } from "@/server/gdpr";
import { invalidatePublicPage } from "@/server/pages";
import type { ActionState } from "./auth";

/**
 * GDPR article 17 — erasure.
 *
 * Requires the user to type their own slug as confirmation, because this is
 * irreversible and cascades to every page, link and statistic they own.
 */
export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };

  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const expected = String(formData.get("expected") ?? "").trim();

  if (!expected || confirmation !== expected) {
    return { fieldErrors: { confirmation: "La confirmation ne correspond pas." } };
  }

  const freedSlugs = await deleteUserAccount(userId);
  if (freedSlugs === null) return { error: "Suppression impossible." };

  // Erasure has to reach the caches too, or the page stays served from a
  // stale copy after the rows are gone.
  for (const slug of freedSlugs) {
    await invalidatePublicPage(slug);
    revalidatePath(`/${slug}`);
  }

  await signOut({ redirect: false });
  redirect("/?deleted=1");
}
