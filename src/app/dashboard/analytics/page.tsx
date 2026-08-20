import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { fullReport, lastNDays } from "@/server/analytics";
import { listShortLinks } from "@/server/shortlinks";
import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { ShortLinkManager } from "@/components/dashboard/ShortLinkManager";
import { can, limitsFor } from "@/lib/plans";
import { appUrl } from "@/lib/urls";

export const metadata = { title: "Statistiques" };

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { plan: true },
  });
  const plan = user?.plan ?? "FREE";

  // The requested window is clamped to what the plan allows, so a Free user
  // cannot widen it by editing the query string.
  const requested = Number((await searchParams).days ?? 30);
  const days = Math.min(
    RANGES.includes(requested as (typeof RANGES)[number]) ? requested : 30,
    limitsFor(plan).analyticsRetentionDays,
  );

  const [report, shortLinks] = await Promise.all([
    fullReport(page.id, lastNDays(days)),
    listShortLinks(page.id),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Statistiques</h1>

        <nav aria-label="Période" className="flex gap-1">
          {RANGES.map((range) => (
            <Link
              key={range}
              href={`/dashboard/analytics?days=${range}`}
              aria-current={range === days ? "page" : undefined}
              className={[
                "rounded-lg px-3 py-1.5 text-sm transition",
                range === days
                  ? "bg-white/10 text-neutral-100"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200",
              ].join(" ")}
            >
              {range} j
            </Link>
          ))}
        </nav>
      </div>

      <AnalyticsView report={report} days={days} canExport={can(plan, "canExportCsv")} />

      <section aria-labelledby="short-heading" className="mt-10">
        <h2 id="short-heading" className="mb-1 text-sm font-medium text-neutral-400">
          Liens courts
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          Un lien court compte chaque clic, même partagé hors de votre page.
        </p>

        <ShortLinkManager
          baseUrl={appUrl("/u")}
          shortLinks={shortLinks.map((s) => ({
            id: s.id,
            code: s.code,
            title: s.title,
            targetUrl: s.targetUrl,
            clicks: s.clicks,
          }))}
          candidates={page.links
            .filter((l) => l.url && (l.type === "LINK" || l.type === "SOCIAL"))
            .map((l) => ({ id: l.id, title: l.title, url: l.url! }))}
        />
      </section>
    </>
  );
}
