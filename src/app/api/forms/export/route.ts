import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { listSubmissions } from "@/server/forms";
import { formFieldsSchema } from "@/lib/forms";
import { toCsv } from "@/lib/csv";

/**
 * CSV export of form submissions.
 *
 * Available on every plan: these are the user's own contacts, and holding
 * someone's inbox hostage behind an upgrade is a different thing from gating
 * an analytics feature.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const page = await getEditablePage(session.user.id);
  if (!page) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });

  const submissions = await listSubmissions(page.id);

  // One column per distinct field across all forms, so a page with several
  // forms exports as a single readable sheet.
  const columns = new Map<string, string>();
  for (const submission of submissions) {
    const fields = formFieldsSchema.safeParse(submission.form.fieldsJson);
    if (!fields.success) continue;
    for (const field of fields.data) columns.set(field.id, field.label);
  }

  const columnIds = [...columns.keys()];
  const headers = ["formulaire", "date", ...columnIds.map((id) => columns.get(id)!)];

  const rows = submissions.map((submission) => {
    const data = submission.dataJson as Record<string, string>;
    return [
      submission.form.title,
      submission.submittedAt.toISOString(),
      ...columnIds.map((id) => data[id] ?? ""),
    ];
  });

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sesame-${page.slug}-reponses.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
