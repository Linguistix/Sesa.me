import { z } from "zod";
import { BLOCK_TYPES, URL_BLOCK_TYPES, type BlockType } from "./block-types";

/**
 * Link validation, kept free of server-only imports so the same rules can run
 * in the browser form and on the server. The server is still the authority —
 * every action re-parses with this schema before touching the database.
 */

/**
 * Public pages render these as `href`, so anything but http(s) is rejected —
 * `javascript:` and `data:` URLs would otherwise be stored XSS.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const linkInputSchema = z
  .object({
    type: z.enum(BLOCK_TYPES).default("LINK"),
    title: z.string().trim().min(1, "Le titre est requis.").max(80),
    url: z.string().trim().max(2048).optional().or(z.literal("")),
    emoji: z.string().trim().max(8).optional().or(z.literal("")),
    body: z.string().trim().max(1000).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
    /** Image URLs for gallery and image blocks. */
    images: z.array(z.string().trim().url().max(2048)).max(24).default([]),
    /** When set, the block's URL and title come from a connected account. */
    syncProvider: z.enum(["SPOTIFY_LATEST_RELEASE", "YOUTUBE_LATEST_VIDEO"]).nullish(),
    /** Empty string clears the gate; undefined leaves it untouched. */
    password: z.string().max(72).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "GALLERY" && val.images.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "Ajoutez au moins une image.",
      });
    }

    if (val.type === "IMAGE" && val.images.length === 0) {
      ctx.addIssue({ code: "custom", path: ["images"], message: "Ajoutez une image." });
    }

    // An image block may link somewhere, but does not have to.
    if (val.type === "IMAGE" && val.url && !isSafeHttpUrl(val.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "L'URL doit commencer par http:// ou https://.",
      });
    }

    // A synced block is filled in by the sync engine on save, so requiring a
    // URL up front would make it impossible to create one.
    if (val.syncProvider) return;

    const needsUrl = URL_BLOCK_TYPES.includes(val.type as BlockType);
    if (!needsUrl) return;

    if (!val.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "L'URL est requise." });
      return;
    }
    if (!isSafeHttpUrl(val.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "L'URL doit commencer par http:// ou https://.",
      });
    }
  });

export type LinkInput = z.infer<typeof linkInputSchema>;
