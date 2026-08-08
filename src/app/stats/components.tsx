import type { ReactNode } from "react";

/**
 * The chart vocabulary for /stats.
 *
 * Everything here is a div with a width, which is the point: the page's marks
 * are hairline-bordered squares like every other surface on the site, and a
 * charting library would arrive with its own rounded, coloured opinions. The
 * palette is the site's — ink on paper, no hue anywhere — so nothing is
 * encoded by colour alone. Rank, length and a written value carry it all.
 */

export function IconMark({
  body,
  width,
  height,
  size = 20,
}: {
  body: string;
  width: number;
  height: number;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={size}
      height={size}
      className="shrink-0 fill-current"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col border border-border bg-background">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-foreground">{title}</h2>
        {hint ? <p className="font-mono text-[10px] text-muted-foreground">{hint}</p> : null}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-background p-4 -mb-px -mr-px">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {/* Proportional figures: tabular digits make a big number look gappy. */}
      <p className="text-2xl leading-none text-foreground">{value}</p>
      {sub ? <p className="font-mono text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/**
 * A rank row: position, an optional icon, a label, its bar, its value.
 *
 * The bar is scaled against the leader rather than the axis maximum, so the
 * top row always fills the track and the shape of the drop-off is the thing
 * you read. Every value is written out beside its bar — the bar is the
 * comparison, the number is the fact.
 */
export function RankRow({
  rank,
  label,
  sublabel,
  icon,
  value,
  max,
  href,
}: {
  rank: number;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  value: number;
  max: number;
  href?: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1.5) : 0;
  const leader = rank === 1;

  const inner = (
    <>
      <span
        className={`w-6 shrink-0 text-right font-mono text-[10px] tabular-nums ${
          leader ? "text-foreground" : "text-muted-foreground/50"
        }`}
      >
        {String(rank).padStart(2, "0")}
      </span>
      {icon ? <span className="text-foreground">{icon}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-foreground">{label}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {value.toLocaleString()}
            {sublabel ? <span className="text-muted-foreground/50"> {sublabel}</span> : null}
          </span>
        </span>
        {/* Track and fill: 6px is thin enough to stay a rule rather than a
            block, and the track is the one-step-off-surface grey. */}
        <span className="block h-1.5 w-full bg-muted">
          <span
            className={`block h-full ${leader ? "bg-foreground" : "bg-muted-foreground/60"}`}
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    </>
  );

  const className =
    "flex items-center gap-3 py-2 transition-opacity hover:opacity-70";

  return href ? (
    <a href={href} className={className} title={`${label} · ${value.toLocaleString()}`}>
      {inner}
    </a>
  ) : (
    <div className={className} title={`${label} · ${value.toLocaleString()}`}>
      {inner}
    </div>
  );
}

export function LegendKey({
  swatch,
  children,
}: {
  swatch: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
      {swatch}
      {children}
    </span>
  );
}

/**
 * Fourteen days of agent traffic, fetches stacked under searches.
 *
 * Columns rather than a line: the series is short, integer and gappy, and a
 * line between two quiet days would draw a slope that never happened.
 */
export function ActivityChart({
  days,
}: {
  days: { day: string; picks: number; searches: number }[];
}) {
  const max = Math.max(...days.map((d) => d.picks + d.searches), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-28 items-end gap-1">
        {days.map((d) => {
          const total = d.picks + d.searches;
          const label = `${d.day} · ${d.picks} fetched / ${d.searches} searched`;
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={label}>
              {total === 0 ? (
                // A day with nothing is a hairline on the baseline, not a gap:
                // the axis stays continuous and the quiet day is visible as
                // quiet rather than missing.
                <div className="h-px w-full bg-border" />
              ) : (
                <div
                  className="flex w-full flex-col justify-end"
                  style={{ height: `${(total / max) * 100}%` }}
                >
                  <div
                    className="dot-field w-full border-x border-t border-foreground"
                    style={{ flexGrow: d.searches }}
                  />
                  {d.searches > 0 && d.picks > 0 ? <div className="h-0.5 w-full bg-background" /> : null}
                  <div className="w-full bg-foreground" style={{ flexGrow: d.picks }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LegendKey swatch={<span className="block h-3 w-3 bg-foreground" />}>
          icons fetched
        </LegendKey>
        <LegendKey swatch={<span className="dot-field block h-3 w-3 border border-foreground" />}>
          searches
        </LegendKey>
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
        <span>{days[0]?.day.slice(5)}</span>
        <span>peak {max.toLocaleString()} calls/day</span>
        <span>today</span>
      </div>
    </div>
  );
}

/**
 * Movers: this week against last, as a bar either side of a centre rule.
 *
 * The direction is carried by which side of the centre the bar sits on and by
 * the signed number — position and text, not colour, which is what lets the
 * whole page stay monochrome without losing the up/down reading.
 */
export function MoverRow({
  fullName,
  icon,
  recent,
  previous,
  scale,
}: {
  fullName: string;
  icon: ReactNode;
  recent: number;
  previous: number;
  scale: number;
}) {
  const delta = recent - previous;
  const pct = scale > 0 ? (Math.abs(delta) / scale) * 100 : 0;
  const up = delta > 0;

  return (
    <div
      className="flex items-center gap-3 py-1.5"
      title={`${fullName} · ${previous} → ${recent} this week`}
    >
      <span className="text-foreground">{icon}</span>
      <span className="w-32 shrink-0 truncate font-mono text-[11px] text-foreground sm:w-44">
        {fullName}
      </span>
      <span className="flex flex-1 items-center">
        <span className="flex flex-1 justify-end">
          {!up ? (
            <span className="block h-1.5 bg-muted-foreground/60" style={{ width: `${pct}%` }} />
          ) : null}
        </span>
        <span className="h-4 w-px shrink-0 bg-border" />
        <span className="flex flex-1 justify-start">
          {up ? <span className="block h-1.5 bg-foreground" style={{ width: `${pct}%` }} /> : null}
        </span>
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
        {up ? "▲" : "▼"} {up ? "+" : ""}
        {delta}
      </span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">{children}</p>
  );
}
