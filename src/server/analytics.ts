import "server-only";
import { prisma } from "@/lib/db";
import type { EventType } from "@/generated/prisma/enums";

export interface IngestInput {
  pageId: string;
  linkId?: string | null;
  type: EventType;
  source: string | null;
  country: string | null;
  device: string | null;
  visitorHash: string | null;
}

/**
 * Records one event.
 *
 * Never awaited on a render path: a failure to log a view must not fail the
 * page, so callers fire this and swallow errors. That is a deliberate
 * trade — analytics completeness loses to availability.
 */
export async function ingest(input: IngestInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        pageId: input.pageId,
        linkId: input.linkId ?? null,
        type: input.type,
        source: input.source,
        country: input.country,
        device: input.device,
        visitorHash: input.visitorHash,
      },
    });
  } catch (error) {
    console.error("[analytics] ingest failed", error);
  }
}

export interface Timeframe {
  from: Date;
  to: Date;
}

export function lastNDays(days: number, now = new Date()): Timeframe {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  return { from, to };
}

export interface PageSummary {
  views: number;
  uniqueVisitors: number;
  clicks: number;
  /** Clicks per view, as a percentage. */
  ctr: number;
}

/** Headline figures for a period. */
export async function summarize(pageId: string, range: Timeframe): Promise<PageSummary> {
  const where = { pageId, createdAt: { gte: range.from, lte: range.to } };

  const [views, clicks, uniques] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...where, type: "PAGE_VIEW" } }),
    prisma.analyticsEvent.count({ where: { ...where, type: "LINK_CLICK" } }),
    prisma.analyticsEvent.findMany({
      where: { ...where, type: "PAGE_VIEW", visitorHash: { not: null } },
      distinct: ["visitorHash"],
      select: { visitorHash: true },
    }),
  ]);

  return {
    views,
    clicks,
    uniqueVisitors: uniques.length,
    // Guard the division: a page with no views has no click-through rate,
    // and reporting it as 0% would read as "nobody clicks" rather than
    // "nobody visited".
    ctr: views === 0 ? 0 : Math.round((clicks / views) * 1000) / 10,
  };
}

export interface DailyPoint {
  date: string;
  views: number;
  clicks: number;
}

/**
 * Daily view/click series, gap-filled so a quiet day plots as zero rather than
 * disappearing and distorting the shape of the chart.
 */
export async function dailySeries(pageId: string, range: Timeframe): Promise<DailyPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date; type: EventType; count: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, "type", COUNT(*) AS count
    FROM analytics_events
    WHERE "pageId" = ${pageId}
      AND "createdAt" >= ${range.from}
      AND "createdAt" <= ${range.to}
    GROUP BY day, "type"
    ORDER BY day ASC
  `;

  const byDay = new Map<string, { views: number; clicks: number }>();
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { views: 0, clicks: 0 };
    if (row.type === "PAGE_VIEW") entry.views += Number(row.count);
    else entry.clicks += Number(row.count);
    byDay.set(key, entry);
  }

  const series: DailyPoint[] = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= range.to) {
    const key = cursor.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { views: 0, clicks: 0 };
    series.push({ date: key, views: entry.views, clicks: entry.clicks });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

export interface Breakdown {
  label: string;
  count: number;
}

async function breakdownBy(
  pageId: string,
  range: Timeframe,
  field: "source" | "country" | "device",
  limit = 8,
): Promise<Breakdown[]> {
  const rows = await prisma.analyticsEvent.groupBy({
    by: [field],
    where: { pageId, createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
    orderBy: { _count: { [field]: "desc" } },
    take: limit,
  });

  return rows.map((row) => ({
    label: (row[field] as string | null) ?? "Direct",
    count: row._count._all,
  }));
}

export function sourceBreakdown(pageId: string, range: Timeframe) {
  return breakdownBy(pageId, range, "source");
}

export function countryBreakdown(pageId: string, range: Timeframe) {
  return breakdownBy(pageId, range, "country");
}

export function deviceBreakdown(pageId: string, range: Timeframe) {
  return breakdownBy(pageId, range, "device");
}

export interface LinkPerformance {
  linkId: string;
  title: string;
  clicks: number;
}

/** Clicks per link, best first — the report creators actually act on. */
export async function linkPerformance(
  pageId: string,
  range: Timeframe,
): Promise<LinkPerformance[]> {
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["linkId"],
    where: {
      pageId,
      type: "LINK_CLICK",
      linkId: { not: null },
      createdAt: { gte: range.from, lte: range.to },
    },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  const links = await prisma.link.findMany({
    where: { id: { in: grouped.map((g) => g.linkId!) } },
    select: { id: true, title: true },
  });
  const titles = new Map(links.map((l) => [l.id, l.title]));

  return grouped
    .map((g) => ({
      linkId: g.linkId!,
      title: titles.get(g.linkId!) ?? "Lien supprimé",
      clicks: g._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

/** Everything the dashboard needs, in one round of parallel queries. */
export async function fullReport(pageId: string, range: Timeframe) {
  const [summary, series, sources, countries, devices, links] = await Promise.all([
    summarize(pageId, range),
    dailySeries(pageId, range),
    sourceBreakdown(pageId, range),
    countryBreakdown(pageId, range),
    deviceBreakdown(pageId, range),
    linkPerformance(pageId, range),
  ]);

  return { summary, series, sources, countries, devices, links };
}

export type FullReport = Awaited<ReturnType<typeof fullReport>>;

/**
 * The two comparable weeks the natural-language summary talks about.
 *
 * Both windows are exactly seven days so the percentage change means what a
 * reader assumes it means; comparing a partial week against a full one would
 * manufacture a decline every Monday.
 */
export function weekOverWeek(now = new Date()): { current: Timeframe; previous: Timeframe } {
  const to = new Date(now);
  const currentFrom = new Date(now);
  currentFrom.setUTCDate(currentFrom.getUTCDate() - 7);

  const previousFrom = new Date(now);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - 14);

  return {
    current: { from: currentFrom, to },
    previous: { from: previousFrom, to: currentFrom },
  };
}

/** Gathers everything the weekly summary needs, with all arithmetic done here. */
export async function weeklySummaryInput(pageId: string, now = new Date()) {
  const { current, previous } = weekOverWeek(now);

  const [thisWeek, lastWeek, sources, links] = await Promise.all([
    summarize(pageId, current),
    summarize(pageId, previous),
    sourceBreakdown(pageId, current),
    linkPerformance(pageId, current),
  ]);

  return {
    views: thisWeek.views,
    clicks: thisWeek.clicks,
    uniqueVisitors: thisWeek.uniqueVisitors,
    ctr: thisWeek.ctr,
    previousViews: lastWeek.views,
    previousClicks: lastWeek.clicks,
    topSources: sources.slice(0, 3),
    topLinks: links.slice(0, 3).map((l) => ({ title: l.title, clicks: l.clicks })),
  };
}
