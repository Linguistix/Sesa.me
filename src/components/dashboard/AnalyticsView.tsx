import type { FullReport } from "@/server/analytics";

/**
 * The analytics dashboard.
 *
 * A server component: the figures come pre-aggregated from Postgres and the
 * chart is inline SVG, so the whole report renders without shipping a
 * charting library to the browser.
 */
export function AnalyticsView({
  report,
  days,
  canExport,
}: {
  report: FullReport;
  days: number;
  canExport: boolean;
}) {
  const { summary, series, sources, countries, devices, links } = report;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vues" value={summary.views} />
        <Stat label="Visiteurs uniques" value={summary.uniqueVisitors} />
        <Stat label="Clics" value={summary.clicks} />
        <Stat label="Taux de clic" value={`${summary.ctr} %`} />
      </section>

      <section aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="mb-3 text-sm font-medium text-neutral-400">
          Évolution sur {days} jours
        </h2>
        <TrendChart series={series} />
      </section>

      <section aria-labelledby="links-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="links-heading" className="text-sm font-medium text-neutral-400">
            Performance par lien
          </h2>
          {canExport ? (
            <a
              href={`/api/analytics/export?days=${days}`}
              download
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-white/5"
            >
              Export CSV
            </a>
          ) : (
            <span className="text-xs text-neutral-600">Export CSV — réservé au plan Pro</span>
          )}
        </div>

        {links.length === 0 ? (
          <Empty>Aucun clic sur la période.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li
                key={link.linkId}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <span className="truncate text-sm text-neutral-200">{link.title}</span>
                <span className="text-sm tabular-nums text-neutral-400">{link.clicks}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-3">
        <Breakdown title="Sources" rows={sources} />
        <Breakdown title="Pays" rows={countries} format={countryName} />
        <Breakdown title="Appareils" rows={devices} format={deviceName} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

/**
 * Inline SVG sparkline of views and clicks.
 *
 * Drawn as a path over a fixed viewBox and scaled with CSS, so it stays crisp
 * at any width without measuring the container on the client.
 */
function TrendChart({ series }: { series: FullReport["series"] }) {
  const width = 720;
  const height = 160;
  const padding = 8;

  const max = Math.max(1, ...series.map((p) => Math.max(p.views, p.clicks)));
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;

  const toPath = (key: "views" | "clicks") =>
    series
      .map((point, index) => {
        const x = padding + index * step;
        const y = height - padding - (point[key] / max) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const total = series.reduce((sum, p) => sum + p.views + p.clicks, 0);

  if (total === 0) {
    return <Empty>Pas encore de données — partagez votre page pour commencer à mesurer.</Empty>;
  }

  return (
    <figure className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        role="img"
        aria-label={`Évolution des vues et des clics sur ${series.length} jours. Maximum ${max} par jour.`}
      >
        <path d={toPath("views")} fill="none" stroke="#818CF8" strokeWidth="2" />
        <path d={toPath("clicks")} fill="none" stroke="#34D399" strokeWidth="2" />
      </svg>

      <figcaption className="mt-3 flex gap-4 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-[#818CF8]" /> Vues
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-[#34D399]" /> Clics
        </span>
      </figcaption>

      {/* The same data as a table, for screen readers and for anyone who wants
          the exact figures rather than the shape. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-neutral-500">Voir les données</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500">
              <th scope="col" className="py-1">Date</th>
              <th scope="col" className="py-1">Vues</th>
              <th scope="col" className="py-1">Clics</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.date} className="text-neutral-300">
                <td className="py-0.5">{point.date}</td>
                <td className="py-0.5 tabular-nums">{point.views}</td>
                <td className="py-0.5 tabular-nums">{point.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Breakdown({
  title,
  rows,
  format = (label: string) => label,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  format?: (label: string) => string;
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <section aria-labelledby={`bd-${title}`}>
      <h2 id={`bd-${title}`} className="mb-3 text-sm font-medium text-neutral-400">
        {title}
      </h2>

      {rows.length === 0 ? (
        <Empty>Aucune donnée.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.label} className="text-sm">
              <div className="flex justify-between text-neutral-300">
                <span className="truncate">{format(row.label)}</span>
                <span className="tabular-nums text-neutral-500">{row.count}</span>
              </div>
              <div aria-hidden className="mt-1 h-1 rounded-full bg-white/5">
                <div
                  className="h-1 rounded-full bg-indigo-500/70"
                  style={{ width: `${total === 0 ? 0 : (row.count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-neutral-500">
      {children}
    </p>
  );
}

const DEVICE_NAMES: Record<string, string> = {
  mobile: "Mobile",
  tablet: "Tablette",
  desktop: "Ordinateur",
};

function deviceName(label: string): string {
  return DEVICE_NAMES[label] ?? label;
}

/** Turns an ISO country code into a localised name, falling back to the code. */
function countryName(label: string): string {
  if (label === "Direct" || label.length !== 2) return label;
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(label) ?? label;
  } catch {
    return label;
  }
}
