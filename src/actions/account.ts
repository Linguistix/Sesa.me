"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { deleteUserAccount } from "@/server/gdpr";
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

  const deleted = await deleteUserAccount(userId);
  if (!deleted) return { error: "Suppression impossible." };

  await signOut({ redirect: false });
  redirect("/?deleted=1");
}
