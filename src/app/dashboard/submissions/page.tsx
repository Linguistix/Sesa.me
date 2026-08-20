import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { listSubmissions } from "@/server/forms";
import { formFieldsSchema } from "@/lib/forms";
import { prisma } from "@/lib/db";
import { FormEditor } from "@/components/dashboard/FormEditor";

export const metadata = { title: "Réponses" };

export default async function SubmissionsPage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  const [submissions, forms] = await Promise.all([
    listSubmissions(page.id),
    prisma.form.findMany({ where: { pageId: page.id }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <>
      {forms.length > 0 ? (
        <section aria-labelledby="forms-heading" className="mb-10">
          <h2 id="forms-heading" className="mb-1 text-lg font-semibold">
            Vos formulaires
          </h2>
          <p className="mb-4 text-sm text-neutral-500">
            Les champs définis ici sont le contrat validé à chaque envoi.
          </p>

          <ul className="flex flex-col gap-4">
            {forms.map((form) => {
              const fields = formFieldsSchema.safeParse(form.fieldsJson);
              if (!fields.success) return null;

              return (
                <li key={form.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <FormEditor
                    form={{
                      id: form.id,
                      title: form.title,
                      successMessage: form.successMessage,
                      webhookUrl: form.webhookUrl,
                      fields: fields.data,
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Réponses reçues</h1>
        {submissions.length > 0 ? (
          <a
            href="/api/forms/export"
            download
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-white/5"
          >
            Export CSV
          </a>
        ) : null}
      </div>

      {submissions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-neutral-500">
          Aucune réponse pour l&apos;instant. Ajoutez un bloc « Formulaire » à votre page pour
          commencer à en recevoir.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {submissions.map((submission) => {
            const fields = formFieldsSchema.safeParse(submission.form.fieldsJson);
            const data = submission.dataJson as Record<string, string>;

            return (
              <li
                key={submission.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium text-neutral-200">{submission.form.title}</h2>
                  <time
                    dateTime={submission.submittedAt.toISOString()}
                    className="text-xs text-neutral-500"
                  >
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(submission.submittedAt)}
                  </time>
                </div>

                <dl className="flex flex-col gap-1 text-sm">
                  {(fields.success ? fields.data : []).map((field) =>
                    data[field.id] ? (
                      <div key={field.id} className="flex gap-2">
                        <dt className="shrink-0 text-neutral-500">{field.label} :</dt>
                        <dd className="whitespace-pre-line break-words text-neutral-200">
                          {data[field.id]}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
