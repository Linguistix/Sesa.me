"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getEditablePage,
  invalidatePublicPage,
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
import { createForm } from "@/server/forms";
import { syncPage } from "@/server/sync";
import { DEFAULT_FORM_FIELDS } from "@/lib/forms";
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
  // Two caches to clear: Next's rendered-page cache, and the shared data cache
  // in front of the database read. Dropping only the first would re-render the
  // page from stale data and look like the edit silently failed.
  await invalidatePublicPage(slug);
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

  const outcome = await updatePageProfile(page.id, userId, parsed.data);

  if (outcome === "ANIMATED_AVATAR_REQUIRES_PRO") {
    return {
      fieldErrors: {
        avatarUrl: "Les avatars animés (GIF, WebP) font partie du plan Pro.",
      },
    };
  }
  if (outcome !== true) return { error: "Mise à jour impossible." };

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
    images: parseImages(formData.get("images")),
    syncProvider: (formData.get("syncProvider") as string) || null,
    isActive: true,
    password: (formData.get("password") as string) || undefined,
  });

  if (!parsed.success) return { fieldErrors: flattenIssues(parsed.error) };

  const created = await createLink(page.id, userId, parsed.data);
  if (!created) return { error: "Création impossible." };

  // A form block is inert without a form to submit to, so the two are
  // created together and share a lifetime — deleting the block cascades.
  if (parsed.data.type === "FORM") {
    await createForm({
      pageId: page.id,
      userId,
      linkId: created.id,
      title: parsed.data.title,
      fields: DEFAULT_FORM_FIELDS,
    });
  }

  // A synced block is created empty; resolving it immediately means the user
  // sees real content rather than a placeholder that fills in later.
  if (parsed.data.syncProvider) await syncPage(page.id, userId);

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
    images: parseImages(formData.get("images")),
    syncProvider: (formData.get("syncProvider") as string) || null,
    isActive: formData.get("isActive") !== "false",
    // A form that does not send the field at all leaves the gate untouched.
    password: rawPassword === null ? undefined : String(rawPassword),
  });

  if (!parsed.success) return { fieldErrors: flattenIssues(parsed.error) };

  const ok = await updateLink(linkId, userId, parsed.data);
  if (!ok) return { error: "Lien introuvable." };

  if (parsed.data.syncProvider) await syncPage(page.id, userId);

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
    images: link.images,
    syncProvider: link.syncProvider,
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


/**
 * Parses the editor's newline-separated image list.
 *
 * A textarea is the right control here — creators paste a batch of URLs from
 * their host — but it means splitting and pruning before validation.
 */
function parseImages(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 24);
}

function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
