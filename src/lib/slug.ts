import { z } from "zod";

/**
 * Slugs live at the site root (`sesa.me/<slug>`), so they share a namespace
 * with every top-level route. Anything added under `src/app/` that is not the
 * public page route must be listed here or a user could claim it.
 */
export const RESERVED_SLUGS = new Set([
  "api", "u", "app", "dashboard", "login", "signup", "signin", "signout", "logout",
  "register", "auth", "admin", "settings", "account", "billing", "pricing", "plans",
  "help", "support", "docs", "blog", "about", "terms", "privacy", "legal", "contact",
  "static", "public", "assets", "images", "img", "fonts", "favicon", "robots",
  "sitemap", "manifest", "sw", "_next", "well-known", "s", "qr", "go", "link",
  "links", "new", "edit", "explore", "discover", "search", "home", "index",
]);

export const SLUG_MIN = 2;
export const SLUG_MAX = 32;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `Le lien doit faire au moins ${SLUG_MIN} caractères.`)
  .max(SLUG_MAX, `Le lien ne peut pas dépasser ${SLUG_MAX} caractères.`)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Uniquement des lettres, chiffres et tirets — ni au début ni à la fin.",
  )
  .refine((s) => !s.includes("--"), "Les tirets doubles ne sont pas autorisés.")
  .refine((s) => !RESERVED_SLUGS.has(s), "Ce lien est réservé.");

/** Best-effort slug from a display name or email, for signup defaults. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");

  return base.length >= SLUG_MIN ? base : `${base}user`.slice(0, SLUG_MAX);
}
