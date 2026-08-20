"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { formFieldsSchema } from "@/lib/forms";
import { isSafeHttpUrl } from "@/lib/links";
import type { ActionState } from "./auth";

const settingsSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis.").max(80),
  successMessage: z.string().trim().min(1, "Le message est requis.").max(300),
  webhookUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || isSafeHttpUrl(v), "L'URL doit commencer par https://")
    .optional(),
});

/**
 * Updates a form's configuration.
 *
 * Ownership is checked through the page relation, and the field definitions
 * are re-validated here rather than trusted from the client — they are the
 * contract every future submission is checked against, so a malformed
 * definition would break the public form for visitors.
 */
export async function updateFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };

  const page = await getEditablePage(userId);
  if (!page) return { error: "Page introuvable." };

  const formId = String(formData.get("formId") ?? "");

  const settings = settingsSchema.safeParse({
    title: formData.get("title"),
    successMessage: formData.get("successMessage"),
    webhookUrl: formData.get("webhookUrl") ?? "",
  });
  if (!settings.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of settings.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { fieldErrors };
  }

  const fields = formFieldsSchema.safeParse(parseFields(formData));
  if (!fields.success) {
    return { fieldErrors: { fields: fields.error.issues[0]!.message } };
  }

  const result = await prisma.form.updateMany({
    where: { id: formId, pageId: page.id },
    data: {
      title: settings.data.title,
      successMessage: settings.data.successMessage,
      webhookUrl: settings.data.webhookUrl || null,
      fieldsJson: fields.data,
    },
  });

  if (result.count !== 1) return { error: "Formulaire introuvable." };

  revalidatePath("/dashboard/submissions");
  revalidatePath(`/${page.slug}`);
  return {};
}

/**
 * Reads the repeated field rows the editor submits.
 *
 * Each row is `field.<index>.<property>`, so the browser can add and remove
 * rows without the server needing to know how many there are in advance.
 */
function parseFields(formData: FormData) {
  const byIndex = new Map<string, Record<string, unknown>>();

  for (const [key, value] of formData.entries()) {
    const match = /^field\.(\d+)\.(id|label|type|required)$/.exec(key);
    if (!match) continue;

    const [, index, property] = match;
    const row = byIndex.get(index!) ?? {};
    row[property!] = property === "required" ? value === "on" || value === "true" : String(value);
    byIndex.set(index!, row);
  }

  return [...byIndex.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, row]) => ({ required: false, ...row }));
}

export async function deleteSubmissionAction(id: string): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Non authentifié." };

  const result = await prisma.formSubmission.deleteMany({
    where: { id, form: { page: { userId } } },
  });
  if (result.count !== 1) return { error: "Réponse introuvable." };

  revalidatePath("/dashboard/submissions");
  return {};
}
