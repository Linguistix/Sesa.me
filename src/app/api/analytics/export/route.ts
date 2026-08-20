import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { fullReport, lastNDays } from "@/server/analytics";
import { toCsv } from "@/lib/csv";
import { can, limitsFor } from "@/lib/plans";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** CSV export of the analytics report. Pro only. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  const plan = user?.plan ?? "FREE";

  if (!can(plan, "canExportCsv")) {
    return NextResponse.json({ error: "Réservé au plan Pro." }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const page = await getEditablePage(session.user.id);
  if (!page) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });

  const days = Math.min(parsed.data.days, limitsFor(plan).analyticsRetentionDays);
  const report = await fullReport(page.id, lastNDays(days));

  // One flat sheet: a daily series, then the per-link totals, so the file is
  // usable in a spreadsheet without pivoting.
  const rows: unknown[][] = [
    ...report.series.map((point) => ["jour", point.date, point.views, point.clicks]),
    ...report.links.map((link) => ["lien", link.title, "", link.clicks]),
  ];

  const csv = toCsv(["type", "libelle", "vues", "clics"], rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sesame-${page.slug}-${days}j.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
