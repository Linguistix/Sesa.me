import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { fullReport, lastNDays, weeklySummaryInput } from "@/server/analytics";
import { weeklySummaryForUser } from "@/server/ai";
import { isAiConfigured } from "@/lib/ai/client";
import { listShortLinks } from "@/server/shortlinks";
import { AnalyticsView } from "@/components/dashboard/AnalyticsView";
import { ShortLinkManager } from "@/components/dashboard/ShortLinkManager";
import { can, limitsFor } from "@/lib/plans";
import { PageHeader, Panel, PageBody, SectionHeader } from "@/components/ui/Panel";
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

  const [report, shortLinks, summary] = await Promise.all([
    fullReport(page.id, lastNDays(days)),
    listShortLinks(page.id),
    // The sentence is a garnish on figures that stand on their own, so a
    // missing or failed summary never blocks the page.
    isAiConfigured()
      ? weeklySummaryInput(page.id).then((input) =>
          weeklySummaryForUser(session!.user.id, input),
        )
      : Promise.resolve(null),
  ]);

  return (
    <PageBody width="wide">
      <PageHeader
        title="Statistiques"
        description="Mesurées sans cookie ni adresse IP conservée."
        action={
          <nav aria-label="Période" className="flex gap-0.5 rounded-lg bg-ink-880 p-0.5 ring-1 ring-inset ring-white/7">
            {RANGES.map((range) => (
              <Link
                key={range}
                href={`/dashboard/analytics?days=${range}`}
                aria-current={range === days ? "page" : undefined}
                className={[
                  "rounded-md px-2.5 py-1 text-xs transition",
                  range === days
                    ? "bg-white/10 text-ink-50"
                    : "text-ink-400 hover:text-ink-100",
                ].join(" ")}
              >
                {range} j
              </Link>
            ))}
          </nav>
        }
      />

      {/* The model phrases the figures; it never computes them. */}
      {summary ? (
        <p className="mb-5 rounded-xl bg-accent-500/[0.07] px-4 py-3 text-sm text-ink-100 ring-1 ring-inset ring-accent-400/25">
          {summary}
        </p>
      ) : null}

      <AnalyticsView report={report} days={days} canExport={can(plan, "canExportCsv")} />

      <Panel className="mt-5 p-5" aria-labelledby="short-heading">
        <SectionHeader
          id="short-heading"
          title="Liens courts"
          description="Un lien court compte chaque clic, même partagé hors de votre page."
        />

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
      </Panel>
    </PageBody>
  );
}
