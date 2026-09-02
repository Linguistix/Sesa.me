import type { FullReport } from "@/server/analytics";
import { Panel, EmptyState, Badge } from "@/components/ui/Panel";

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
    <div className="flex flex-col gap-6">
      {/*
        The four headline figures carry the most weight on the screen, so they
        get the largest type on it. Everything below is a breakdown of these.
      */}
      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vues" value={summary.views} />
        <Stat label="Visiteurs uniques" value={summary.uniqueVisitors} />
        <Stat label="Clics" value={summary.clicks} />
        <Stat label="Taux de clic" value={`${summary.ctr} %`} />
      </section>

      <Panel className="p-5">
        <ChartHeading id="chart-heading">Évolution sur {days} jours</ChartHeading>
        <TrendChart series={series} />
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <ChartHeading id="links-heading" flush>
            Performance par lien
          </ChartHeading>
          {canExport ? (
            <a
              href={`/api/analytics/export?days=${days}`}
              download
              className="rounded-md px-2.5 py-1 text-xs text-ink-200 ring-1 ring-inset ring-white/12 transition hover:bg-white/5"
            >
              Export CSV
            </a>
          ) : (
            <Badge>Export CSV — plan Pro</Badge>
          )}
        </div>

        {links.length === 0 ? (
          <EmptyState
            bare
            title="Aucun clic sur la période"
            description="Dès qu'un visiteur clique sur un de vos blocs, il apparaît ici."
          />
        ) : (
          <ol className="flex flex-col">
            {links.map((link, index) => (
              <li
                key={link.linkId}
                className="flex items-center gap-3 border-t border-white/6 py-2.5 first:border-t-0 first:pt-0"
              >
                <span aria-hidden className="tabular w-5 shrink-0 text-xs text-ink-600">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-base text-ink-100">{link.title}</span>
                <span className="tabular shrink-0 text-base text-ink-300">{link.clicks}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="Sources" rows={sources} />
        <Breakdown title="Pays" rows={countries} format={countryName} />
        <Breakdown title="Appareils" rows={devices} format={deviceName} />
      </div>
    </div>
  );
}

/** One heading treatment for every block on this screen. */
function ChartHeading({
  id,
  flush = false,
  children,
}: {
  id: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className={`text-2xs font-medium uppercase tracking-[0.08em] text-ink-500 ${flush ? "" : "mb-4"}`}
    >
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Panel className="px-4 py-3.5">
      <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-500">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-ink-50">{value}</p>
    </Panel>
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

  const point = (key: "views" | "clicks", index: number) => {
    const p = series[index];
    return {
      x: padding + index * step,
      y: height - padding - (p[key] / max) * (height - padding * 2),
    };
  };

  const toPath = (key: "views" | "clicks") =>
    series
      .map((_, index) => {
        const { x, y } = point(key, index);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  // Closes the views line down to the baseline so it can be filled — the fill
  // is what makes the two series readable as "of which" rather than unrelated.
  const toArea = (key: "views" | "clicks") => {
    if (series.length < 2) return "";
    const first = point(key, 0);
    const last = point(key, series.length - 1);
    return `${toPath(key)} L${last.x.toFixed(1)},${height - padding} L${first.x.toFixed(1)},${height - padding} Z`;
  };

  const total = series.reduce((sum, p) => sum + p.views + p.clicks, 0);

  if (total === 0) {
    return (
      <EmptyState
        bare
        title="Pas encore de données"
        description="Partagez votre page — les vues et les clics apparaîtront ici au fil des visites."
      />
    );
  }

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label={`Évolution des vues et des clics sur ${series.length} jours. Maximum ${max} par jour.`}
      >
        <defs>
          <linearGradient id="views-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-400)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent-400)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={toArea("views")} fill="url(#views-fill)" stroke="none" />
        <path
          d={toPath("views")}
          fill="none"
          stroke="var(--color-accent-400)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={toPath("clicks")}
          fill="none"
          stroke="var(--color-positive-400)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <figcaption className="mt-3 flex gap-4 text-xs text-ink-400">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-accent-400" /> Vues
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-positive-400" /> Clics
        </span>
      </figcaption>

      {/* The same data as a table, for screen readers and for anyone who wants
          the exact figures rather than the shape. */}
      <details className="mt-3 border-t border-white/6 pt-3">
        <summary className="cursor-pointer text-xs text-ink-400 transition-colors hover:text-ink-200">
          Voir les données
        </summary>
        <table className="tabular mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-ink-500">
              <th scope="col" className="py-1 font-medium">Date</th>
              <th scope="col" className="py-1 font-medium">Vues</th>
              <th scope="col" className="py-1 font-medium">Clics</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.date} className="text-ink-300">
                <td className="py-0.5">{p.date}</td>
                <td className="py-0.5">{p.views}</td>
                <td className="py-0.5">{p.clicks}</td>
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
    <Panel className="p-5" aria-labelledby={`bd-${title}`}>
      <ChartHeading id={`bd-${title}`}>{title}</ChartHeading>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-400">Aucune donnée.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.label} className="text-base">
              <div className="flex justify-between gap-3 text-ink-200">
                <span className="truncate">{format(row.label)}</span>
                <span className="tabular shrink-0 text-ink-400">{row.count}</span>
              </div>
              <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/6">
                <div
                  className="h-1 rounded-full bg-accent-500"
                  style={{ width: `${total === 0 ? 0 : (row.count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
