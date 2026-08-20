import "server-only";
import { prisma } from "@/lib/db";
import {
  formFieldsSchema,
  submissionSchema,
  toStoredData,
  type FormField,
} from "@/lib/forms";

/** Reads a form and its validated field definitions. */
export async function getForm(formId: string) {
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) return null;

  const fields = formFieldsSchema.safeParse(form.fieldsJson);
  if (!fields.success) return null;

  return { ...form, fields: fields.data };
}

export async function getFormForLink(linkId: string) {
  const form = await prisma.form.findUnique({ where: { linkId } });
  if (!form) return null;

  const fields = formFieldsSchema.safeParse(form.fieldsJson);
  if (!fields.success) return null;

  return { ...form, fields: fields.data };
}

export type SubmitResult =
  | { ok: true; message: string }
  | { ok: false; fieldErrors: Record<string, string> }
  | { ok: false; error: string };

/**
 * Accepts a visitor's submission.
 *
 * The stored field definitions are the contract — the browser's idea of the
 * form is never trusted. Unknown keys are dropped, required fields enforced,
 * and lengths capped, so a public endpoint cannot be turned into free storage.
 */
export async function submitForm(
  formId: string,
  raw: Record<string, unknown>,
): Promise<SubmitResult> {
  const form = await getForm(formId);
  if (!form) return { ok: false, error: "Formulaire introuvable." };

  const parsed = submissionSchema(form.fields).safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const data = toStoredData(form.fields, parsed.data as Record<string, unknown>);

  await prisma.formSubmission.create({ data: { formId: form.id, dataJson: data } });

  // The webhook is best-effort: a third-party outage must not lose the
  // submission, which is already durably stored above.
  if (form.webhookUrl) void forward(form.webhookUrl, form.id, data);

  return { ok: true, message: form.successMessage };
}

async function forward(webhookUrl: string, formId: string, data: Record<string, string>) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId, submittedAt: new Date().toISOString(), data }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("[forms] webhook delivery failed", error);
  }
}

export async function listSubmissions(pageId: string, formId?: string) {
  return prisma.formSubmission.findMany({
    where: { form: { pageId, ...(formId ? { id: formId } : {}) } },
    orderBy: { submittedAt: "desc" },
    take: 500,
    include: { form: { select: { id: true, title: true, fieldsJson: true } } },
  });
}

export async function createForm(params: {
  pageId: string;
  userId: string;
  linkId: string;
  title: string;
  fields: FormField[];
}) {
  const page = await prisma.page.findFirst({
    where: { id: params.pageId, userId: params.userId },
    select: { id: true },
  });
  if (!page) return null;

  return prisma.form.create({
    data: {
      pageId: params.pageId,
      linkId: params.linkId,
      title: params.title,
      fieldsJson: params.fields,
    },
  });
}

export async function deleteSubmission(id: string, userId: string) {
  const result = await prisma.formSubmission.deleteMany({
    where: { id, form: { page: { userId } } },
  });
  return result.count === 1;
}
