"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getEditablePage,
  isSlugAvailable,
  pageProfileSchema,
  updatePageProfile,
  updatePageTheme,
} from "@/server/pages";
import {
  createLink,
  deleteLink,
  linkInputSchema,
  reorderLinks,
  updateLink,
} from "@/server/links";
import { themeSchema } from "@/lib/theme/schema";
import { findPreset } from "@/lib/theme/presets";
import type { ActionState } from "./auth";

/** Resolves the caller's user id, or throws — every mutation below needs one. */
async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}

/**
 * Editing a page changes what the public route serves, so both the dashboard
 * and the public slug are revalidated after every successful mutation.
 */
async function revalidatePageRoutes(slug: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/${slug}`);
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const parsed = pageProfileSchema.safeParse({
    slug: formData.get("slug"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    avatarUrl: formData.get("avatarUrl") || undefined,
  });

  if (!parsed.success) return { fieldErrors: flattenIssues(parsed.error) };

  if (!(await isSlugAvailable(parsed.data.slug, page.id))) {
    return { fieldErrors: { slug: "Ce lien est déjà pris." } };
  }

  const ok = await updatePageProfile(page.id, userId, parsed.data);
  if (!ok) return { error: "Mise à jour impossible." };

  await revalidatePageRoutes(page.slug);
  if (parsed.data.slug !== page.slug) await revalidatePageRoutes(parsed.data.slug);
  return {};
}

export async function createLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const parsed = linkInputSchema.safeParse({
    type: formData.get("type") || "LINK",
    title: formData.get("title"),
    url: formData.get("url") || "",
    emoji: formData.get("emoji") || "",
    body: formData.get("body") || "",
    isActive: true,
    password: (formData.get("password") as string) || undefined,
  });

  if (!parsed.success) return { fieldErrors: flattenIssues(parsed.error) };

  await createLink(page.id, userId, parsed.data);
  await revalidatePageRoutes(page.slug);
  return {};
}

export async function updateLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const linkId = String(formData.get("linkId") ?? "");
  const rawPassword = formData.get("password");

  const parsed = linkInputSchema.safeParse({
    type: formData.get("type") || "LINK",
    title: formData.get("title"),
    url: formData.get("url") || "",
    emoji: formData.get("emoji") || "",
    body: formData.get("body") || "",
    isActive: formData.get("isActive") !== "false",
    // A form that does not send the field at all leaves the gate untouched.
    password: rawPassword === null ? undefined : String(rawPassword),
  });

  if (!parsed.success) return { fieldErrors: flattenIssues(parsed.error) };

  const ok = await updateLink(linkId, userId, parsed.data);
  if (!ok) return { error: "Lien introuvable." };

  await revalidatePageRoutes(page.slug);
  return {};
}

export async function deleteLinkAction(linkId: string): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const ok = await deleteLink(linkId, userId);
  if (!ok) return { error: "Lien introuvable." };

  await revalidatePageRoutes(page.slug);
  return {};
}

export async function toggleLinkAction(linkId: string, isActive: boolean): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const link = page.links.find((l) => l.id === linkId);
  if (!link) return { error: "Lien introuvable." };

  await updateLink(linkId, userId, {
    type: link.type,
    title: link.title,
    url: link.url ?? "",
    emoji: link.emoji ?? "",
    body: link.body ?? "",
    isActive,
    password: undefined,
  });

  await revalidatePageRoutes(page.slug);
  return {};
}

export async function reorderLinksAction(orderedIds: string[]): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const ids = z.array(z.string().cuid2().or(z.string().min(1))).max(500).parse(orderedIds);
  await reorderLinks(page.id, userId, ids);
  await revalidatePageRoutes(page.slug);
  return {};
}

export async function applyThemeAction(theme: unknown): Promise<ActionState> {
  const userId = await requireUserId();
  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return { error: "Thème invalide." };

  await updatePageTheme(page.id, userId, parsed.data);
  await revalidatePageRoutes(page.slug);
  return {};
}

export async function applyPresetAction(presetId: string): Promise<ActionState> {
  const preset = findPreset(presetId);
  if (!preset) return { error: "Thème inconnu." };
  return applyThemeAction(preset.theme);
}

function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
