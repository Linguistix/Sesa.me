import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { listSubmissions } from "@/server/forms";
import { formFieldsSchema } from "@/lib/forms";
import { prisma } from "@/lib/db";
import { FormEditor } from "@/components/dashboard/FormEditor";
import { PageHeader, PageBody, Panel, SectionHeader, EmptyState } from "@/components/ui/Panel";

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
    <PageBody>
      {/*
        The page heading comes first. It used to sit below the forms editor,
        which put an `h2` ahead of the `h1` — a screen reader reading the
        outline heard a subsection before the thing it belongs to.
      */}
      <PageHeader
        title="Réponses reçues"
        description="Ce que vos visiteurs vous ont envoyé depuis vos blocs « Formulaire »."
        action={
          submissions.length > 0 ? (
            <a
              href="/api/forms/export"
              download
              className="rounded-md px-2.5 py-1 text-xs text-ink-200 ring-1 ring-inset ring-white/12 transition hover:bg-white/5"
            >
              Export CSV
            </a>
          ) : null
        }
      />

      {forms.length > 0 ? (
        <Panel className="mb-5 p-5" as="section" aria-labelledby="forms-heading">
          <SectionHeader
            id="forms-heading"
            title="Vos formulaires"
            description="Les champs définis ici sont le contrat validé à chaque envoi."
          />

          <ul className="flex flex-col gap-4">
            {forms.map((form) => {
              const fields = formFieldsSchema.safeParse(form.fieldsJson);
              if (!fields.success) return null;

              return (
                <li
                  key={form.id}
                  className="border-t border-white/6 pt-4 first:border-t-0 first:pt-0"
                >
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
        </Panel>
      ) : null}

      {submissions.length === 0 ? (
        <EmptyState
          title="Aucune réponse pour l'instant"
          description="Ajoutez un bloc « Formulaire » à votre page pour commencer à en recevoir."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {submissions.map((submission) => {
            const fields = formFieldsSchema.safeParse(submission.form.fieldsJson);
            const data = submission.dataJson as Record<string, string>;

            return (
              <Panel as="article" key={submission.id} className="p-4">
                <div className="mb-2.5 flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-medium text-ink-100">{submission.form.title}</h2>
                  <time
                    dateTime={submission.submittedAt.toISOString()}
                    className="shrink-0 text-xs text-ink-400"
                  >
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(submission.submittedAt)}
                  </time>
                </div>

                <dl className="flex flex-col gap-1.5 text-base">
                  {(fields.success ? fields.data : []).map((field) =>
                    data[field.id] ? (
                      <div key={field.id} className="flex gap-2">
                        <dt className="shrink-0 text-ink-400">{field.label} :</dt>
                        <dd className="whitespace-pre-line break-words text-ink-100">
                          {data[field.id]}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </Panel>
            );
          })}
        </ul>
      )}
    </PageBody>
  );
}
