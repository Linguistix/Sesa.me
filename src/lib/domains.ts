import { z } from "zod";

/**
 * Hostname validation for custom domains.
 *
 * Kept free of server-only imports so the settings form can validate as the
 * user types; the server re-parses with the same schema before any write.
 *
 * Deliberately stricter than the RFC: no trailing dot, no single label, no
 * IP literal, no port. A value that reaches here becomes a routing key, so
 * ambiguity is worse than rejecting an exotic-but-legal name.
 */
export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(
    /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/,
    "Nom de domaine invalide (exemple : liens.mon-site.fr).",
  )
  .refine((h) => !h.split(".").some((label) => label.startsWith("-") || label.endsWith("-")), {
    message: "Nom de domaine invalide.",
  });

/** The DNS label the ownership token is published under. */
export const TXT_RECORD_NAME = "_sesame-challenge";
