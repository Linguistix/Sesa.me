import { z } from "zod";

/**
 * Form field definitions.
 *
 * A page owner designs their own form, so the field list is data rather than
 * code. Every submission is validated against the *stored* definition, never
 * against what the browser posted — otherwise a crafted request could add
 * fields the owner never asked for.
 */

export const MISSING_FIELD_MESSAGE = "Ce champ est requis.";

export const formFieldSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_]{1,32}$/, "Identifiant de champ invalide."),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "email", "textarea", "tel"]),
  required: z.boolean().default(false),
  placeholder: z.string().trim().max(80).optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;

export const formFieldsSchema = z
  .array(formFieldSchema)
  .min(1, "Ajoutez au moins un champ.")
  .max(12, "12 champs au maximum.")
  .refine(
    (fields) => new Set(fields.map((f) => f.id)).size === fields.length,
    "Deux champs ne peuvent pas avoir le même identifiant.",
  );

/** The default a new form starts with: name + email + message. */
export const DEFAULT_FORM_FIELDS: FormField[] = [
  { id: "name", label: "Votre nom", type: "text", required: true },
  { id: "email", label: "Votre e-mail", type: "email", required: true },
  { id: "message", label: "Votre message", type: "textarea", required: false },
];

/**
 * Builds a validator for one form's stored field definitions.
 *
 * Unknown keys are stripped rather than rejected: a stale browser tab posting
 * a field the owner has since removed should still deliver the rest, not fail
 * outright in front of a visitor.
 */
export function submissionSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // The message is set at construction so an *absent* key reports "this
    // field is required" rather than Zod's internal type error, which would
    // reach a visitor as untranslated English.
    const missing = { error: MISSING_FIELD_MESSAGE };
    let validator: z.ZodTypeAny;

    switch (field.type) {
      case "email":
        validator = z.string(missing).trim().email("Adresse e-mail invalide.").max(320);
        break;
      case "tel":
        validator = z
          .string(missing)
          .trim()
          .max(32)
          .regex(/^[0-9+().\s-]*$/, "Numéro de téléphone invalide.");
        break;
      case "textarea":
        validator = z.string(missing).trim().max(5000);
        break;
      case "text":
        validator = z.string(missing).trim().max(500);
        break;
    }

    if (field.required) {
      validator = (validator as z.ZodString).min(1, MISSING_FIELD_MESSAGE);
    } else {
      validator = validator.optional().or(z.literal(""));
    }

    shape[field.id] = validator;
  }

  // `strip` (the default) drops keys not in the shape.
  return z.object(shape);
}

/** Normalises a validated submission into the JSON column's shape. */
export function toStoredData(
  fields: FormField[],
  parsed: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = parsed[field.id];
    if (typeof value === "string" && value.length > 0) out[field.id] = value;
  }
  return out;
}
