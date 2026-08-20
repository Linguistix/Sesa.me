"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { attachDomain, detachDomain, verifyDomain } from "@/server/domains";
import type { ActionState } from "./auth";

async function context() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");

  const [page, user] = await Promise.all([
    getEditablePage(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);

  return { userId, page, plan: user?.plan ?? ("FREE" as const) };
}

export async function attachDomainAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, page, plan } = await context();
  if (!page) return { error: "Page introuvable." };

  const result = await attachDomain(page.id, userId, plan, String(formData.get("hostname") ?? ""));
  if (!result.ok) return { fieldErrors: { hostname: result.error } };

  revalidatePath("/dashboard/domain");
  return {};
}

export async function verifyDomainAction(): Promise<ActionState> {
  const { userId, page } = await context();
  if (!page) return { error: "Page introuvable." };

  const verified = await verifyDomain(page.id, userId);
  revalidatePath("/dashboard/domain");

  return verified
    ? {}
    : {
        error:
          "Enregistrement TXT introuvable. La propagation DNS peut prendre jusqu'à 48 heures.",
      };
}

export async function detachDomainAction(): Promise<ActionState> {
  const { userId, page } = await context();
  if (!page) return { error: "Page introuvable." };

  await detachDomain(page.id, userId);
  revalidatePath("/dashboard/domain");
  return {};
}
