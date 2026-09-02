import type { ComponentProps, ReactNode } from "react";

/**
 * A raised surface.
 *
 * Separation comes from a hairline plus one step of background, not from a
 * heavy shadow. At these darknesses a large shadow reads as a smudge; the
 * edge is what the eye actually uses to find the plane.
 */
export function Panel({
  className = "",
  inset = false,
  as: Tag = "div",
  children,
  ...props
}: ComponentProps<"div"> & {
  inset?: boolean;
  /**
   * The element to render. A panel is often also a landmark — a `section` with
   * a heading, an `aside` — and wrapping one in a plain `div` throws that away.
   * Deliberately a small union rather than a fully polymorphic component: the
   * generic version costs a lot of type machinery to support elements no panel
   * has ever needed.
   */
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={[
        "rounded-xl bg-ink-880 ring-1 ring-inset ring-white/7 shadow-panel",
        inset ? "p-5" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * A section heading with optional description and trailing action.
 *
 * Exists so every screen states its hierarchy the same way. When each page
 * hand-rolls its heading, the type scale drifts within a release or two.
 */
export function SectionHeader({
  title,
  description,
  action,
  id,
  level = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  level?: "h1" | "h2" | "h3";
}) {
  const Heading = level;
  const size = level === "h1" ? "text-xl" : "text-md";

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading id={id} className={`${size} font-semibold tracking-tight text-ink-50`}>
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-ink-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "positive" | "caution" | "critical";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-white/6 text-ink-200 ring-white/10",
    accent: "bg-accent-500/14 text-accent-300 ring-accent-400/25",
    positive: "bg-positive-500/14 text-positive-400 ring-positive-400/25",
    caution: "bg-caution-500/14 text-caution-400 ring-caution-400/25",
    critical: "bg-critical-500/14 text-critical-400 ring-critical-400/25",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Empty states, so "nothing here" still looks composed. */
export function EmptyState({
  title,
  description,
  action,
  bare = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * Drops the dashed outline, for an empty state already inside a `Panel`.
   * The outline stands in for a missing content area; drawn inside a panel it
   * just reads as a box in a box.
   */
  bare?: boolean;
}) {
  return (
    <div
      className={
        bare
          ? "px-6 py-8 text-center"
          : "rounded-xl border border-dashed border-white/10 px-6 py-10 text-center"
      }
    >
      <p className="text-base font-medium text-ink-200">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * The heading every dashboard screen opens with.
 *
 * Before this existed each page wrote its own `h1` and picked its own bottom
 * margin, so moving between screens shifted the first line of content by a few
 * pixels — the kind of drift nobody reports as a bug but everybody feels.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink-50">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-ink-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * A screen's content column.
 *
 * Two widths, chosen deliberately: `reading` for forms and prose, where a long
 * line is harder to follow and a full-width input invites nothing; `wide` for
 * tables and charts, which need the room. Picking per screen used to be done by
 * remembering to add `max-w-2xl`, which is why half the screens were missing it.
 *
 * Named `PageBody` rather than `Screen` because `Screen` is a DOM global: the
 * collision resolves to the interface and the component fails to typecheck in
 * a way that does not mention the shadowing at all.
 */
export function PageBody({
  width = "reading",
  children,
}: {
  width?: "reading" | "wide";
  children: ReactNode;
}) {
  return <div className={width === "reading" ? "max-w-2xl" : "max-w-5xl"}>{children}</div>;
}
