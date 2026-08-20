import { z } from "zod";

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
    type: z.enum(["LINK", "HEADING", "TEXT", "SOCIAL"]).default("LINK"),
    title: z.string().trim().min(1, "Le titre est requis.").max(80),
    url: z.string().trim().max(2048).optional().or(z.literal("")),
    emoji: z.string().trim().max(8).optional().or(z.literal("")),
    body: z.string().trim().max(1000).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
    /** Empty string clears the gate; undefined leaves it untouched. */
    password: z.string().max(72).optional(),
  })
  .superRefine((val, ctx) => {
    const needsUrl = val.type === "LINK" || val.type === "SOCIAL";
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
