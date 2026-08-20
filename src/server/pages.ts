import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { slugSchema } from "@/lib/slug";
import { sanitizeTheme } from "@/lib/theme/sanitize";
import { formFieldsSchema } from "@/lib/forms";
import { avatarAllowed } from "@/lib/avatar";
import { can } from "@/lib/plans";
import { DEFAULT_THEME } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/schema";

export const pageProfileSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().min(1, "Le nom affiché est requis.").max(60),
  bio: z.string().trim().max(280, "La bio ne peut pas dépasser 280 caractères.").optional(),
  avatarUrl: z.string().trim().url("URL d'avatar invalide.").max(2048).optional().or(z.literal("")),
});

export type PageProfileInput = z.infer<typeof pageProfileSchema>;

/**
 * Loads a page for public rendering. Returns null for unknown or unpublished
 * slugs so the route can render a real 404 rather than an empty page.
 *
 * The stored theme is re-validated on read, not trusted: the column is JSON,
 * and a row could predate a schema change or have been written by an older
 * build. `sanitizeTheme` falls back to the default rather than throwing.
 */
export async function getPublicPage(slug: string) {
  const page = await prisma.page.findUnique({
    where: { slug: slug.toLowerCase() },
    include: {
      links: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: { form: true },
      },
      user: { select: { plan: true, locale: true } },
    },
  });

  if (!page || !page.isPublished) return null;

  const { theme } = sanitizeTheme(page.themeJson);

  return {
    id: page.id,
    slug: page.slug,
    displayName: page.displayName,
    bio: page.bio,
    avatarUrl: page.avatarUrl,
    plan: page.user.plan,
    isVerified: can(page.user.plan, "verifiedBadge"),
    /// The owner's locale, used as the fallback when a visitor's browser
    /// asks for a language the app does not support.
    ownerLocale: page.user.locale,
    theme,
    links: page.links.map((l) => {
      const isLocked = l.passwordHash !== null;
      return {
        id: l.id,
        type: l.type,
        title: l.title,
        // A gated link's destination stays server-side entirely: the hash is
        // never sent, and neither is the URL it protects. Anything shipped here
        // ends up in the HTML, which would make the password decorative.
        // `POST /api/links/:id/unlock` hands it over once bcrypt agrees.
        url: isLocked ? null : l.url,
        emoji: l.emoji,
        iconUrl: l.iconUrl,
        body: l.body,
        images: l.images,
        isLocked,
        form: l.form ? toRenderableForm(l.form) : null,
      };
    }),
  };
}

export type PublicPage = NonNullable<Awaited<ReturnType<typeof getPublicPage>>>;

/** The signed-in user's page, with all blocks including inactive ones. */
export async function getEditablePage(userId: string) {
  const page = await prisma.page.findFirst({
    where: { userId },
    include: { links: { orderBy: { position: "asc" } } },
  });

  if (!page) return null;

  const { theme } = sanitizeTheme(page.themeJson);
  return { ...page, theme };
}

export type EditablePage = NonNullable<Awaited<ReturnType<typeof getEditablePage>>>;

/** True when the slug is free (or already belongs to `exceptPageId`). */
export async function isSlugAvailable(slug: string, exceptPageId?: string): Promise<boolean> {
  const existing = await prisma.page.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true },
  });
  return !existing || existing.id === exceptPageId;
}

export async function createPageForUser(userId: string, input: PageProfileInput) {
  return prisma.page.create({
    data: {
      userId,
      slug: input.slug,
      displayName: input.displayName,
      bio: input.bio || null,
      avatarUrl: input.avatarUrl || null,
      themeJson: DEFAULT_THEME,
    },
  });
}

export async function updatePageProfile(pageId: string, userId: string, input: PageProfileInput) {
  // Animated avatars are a Pro feature. Checking here rather than only in the
  // form matters: the field is a plain URL a Free user can edit directly.
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!avatarAllowed(input.avatarUrl || null, can(owner?.plan ?? "FREE", "canUseAnimatedAvatar"))) {
    return "ANIMATED_AVATAR_REQUIRES_PRO" as const;
  }

  // The userId in the where-clause is the authorisation check: a mismatched
  // owner updates zero rows instead of somebody else's page.
  const result = await prisma.page.updateMany({
    where: { id: pageId, userId },
    data: {
      slug: input.slug,
      displayName: input.displayName,
      bio: input.bio || null,
      avatarUrl: input.avatarUrl || null,
    },
  });
  return result.count === 1 ? true : ("NOT_FOUND" as const);
}

export async function updatePageTheme(pageId: string, userId: string, theme: Theme) {
  const { theme: safe } = sanitizeTheme(theme);
  const result = await prisma.page.updateMany({
    where: { id: pageId, userId },
    data: { themeJson: safe },
  });
  return result.count === 1;
}

/**
 * Validates a form's stored field definitions on read.
 *
 * The column is JSON, so a row could predate a schema change. A form whose
 * definition no longer parses renders as nothing rather than as a broken
 * input list.
 */
function toRenderableForm(form: { id: string; fieldsJson: unknown }) {
  const fields = formFieldsSchema.safeParse(form.fieldsJson);
  return fields.success ? { id: form.id, fields: fields.data } : null;
}
