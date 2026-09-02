"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateThemeForUser, themeQuota } from "@/server/ai";
import { getEditablePage, invalidatePublicPage, updatePageTheme } from "@/server/pages";
import { revalidatePath } from "next/cache";
import type { Theme } from "@/lib/theme/schema";
import type { ContrastFix } from "@/lib/theme/sanitize";

const descriptionSchema = z
  .string()
  .trim()
  .min(3, "Décrivez le style voulu en quelques mots.")
  .max(400, "Description trop longue (400 caractères maximum).");

export interface GenerateThemeState {
  theme?: Theme;
  fixes?: ContrastFix[];
  usedFallback?: boolean;
  remaining?: number;
  error?: string;
}

/**
 * Generates a theme and returns it for preview — without saving.
 *
 * Generation and application are deliberately separate: the brief asks for an
 * instant preview the user can regenerate or adjust before committing, and a
 * generation that silently overwrote a live page would make experimenting
 * costly.
 */
export async function generateThemeAction(description: string): Promise<GenerateThemeState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };

  const parsed = descriptionSchema.safeParse(description);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const plan = user?.plan ?? "FREE";

  const outcome = await generateThemeForUser(userId, plan, parsed.data);

  if (!outcome.ok) {
    switch (outcome.reason) {
      case "quota":
        return {
          error: `Vous avez utilisé vos ${outcome.quota.limit} générations du mois. Passez à Pro pour un accès illimité.`,
          remaining: 0,
        };
      case "burst":
        return {
          error: "Trop de générations d'affilée. Réessayez dans une minute.",
        };
      case "unavailable":
        return { error: "La génération par IA n'est pas configurée sur cette instance." };
      case "misconfigured":
        // Surfaced rather than swallowed: this is a deployment problem, and
        // retrying it forever is the one thing that cannot help.
        return { error: `L'API a refusé la requête : ${outcome.detail}` };
      case "failed":
        return { error: "La génération a échoué. Réessayez dans un instant." };
    }
  }

  return {
    theme: outcome.result.theme,
    fixes: outcome.result.fixes,
    usedFallback: outcome.result.usedFallback,
    remaining: outcome.quota.remaining,
  };
}

/** Saves a previously generated theme. Re-validated server-side on the way in. */
export async function applyGeneratedThemeAction(theme: unknown): Promise<{ error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };

  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  // `updatePageTheme` runs the theme through `sanitizeTheme` again — the
  // client is never trusted to have preserved what generation produced.
  const ok = await updatePageTheme(page.id, userId, theme as Theme);
  if (!ok) return { error: "Enregistrement impossible." };

  await invalidatePublicPage(page.slug);
  revalidatePath("/dashboard/appearance");
  revalidatePath(`/${page.slug}`);
  return {};
}

export async function quotaAction(): Promise<{ used: number; limit: number; remaining: number }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { used: 0, limit: 0, remaining: 0 };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const quota = await themeQuota(userId, user?.plan ?? "FREE");
  return { used: quota.used, limit: quota.limit, remaining: quota.remaining };
}
