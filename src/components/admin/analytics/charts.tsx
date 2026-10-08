import { useMemo, useState, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { bucketLabel, compact, type Report } from "./api";
import { METRIC_LABELS, VIZ, type Metric } from "./viz";

// ─── Traffic chart ────────────────────────────────────────────────────────────

type Row = { t: string; label: string; current: number; previous: number | null };

function TrafficTooltip({ active, payload, bucket, metric }: TooltipProps<number, string> & { bucket: Report["bucket"]; metric: Metric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-background/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 text-muted-foreground">{bucketLabel(row.t, bucket, true)}</p>
      <p className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: VIZ.series }} />
        <span className="text-sm font-semibold tabular-nums">{row.current.toLocaleString()}</span>
        <span className="text-muted-foreground">{METRIC_LABELS[metric].toLowerCase()}</span>
      </p>
      {row.previous !== null && (
        <p className="mt-1 flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: VIZ.compare }} />
          <span className="font-semibold tabular-nums text-foreground/80">{row.previous.toLocaleString()}</span>
          <span className="text-muted-foreground">previous period</span>
        </p>
      )}
    </div>
  );
}

export function TrafficChart({ report, metric, showPrevious }: { report: Report; metric: Metric; showPrevious: boolean }) {
  const rows: Row[] = useMemo(
    () =>
      report.series.map((p, i) => ({
        t: p.t,
        label: bucketLabel(p.t, report.bucket),
        current: p[metric],
        previous: showPrevious ? (report.previous_series[i]?.[metric] ?? null) : null,
      })),
    [report, metric, showPrevious],
  );

  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label={`${METRIC_LABELS[metric]} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={VIZ.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: VIZ.baseline }}
            tick={{ fill: VIZ.muted, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={28}
            tickMargin={8}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} tick={{ fill: VIZ.muted, fontSize: 11 }} tickFormatter={(v: number) => compact(v)} />
          <Tooltip
            cursor={{ stroke: VIZ.muted, strokeWidth: 1 }}
            content={<TrafficTooltip bucket={report.bucket} metric={metric} />}
            isAnimationActive={false}
          />
          {showPrevious && (
            <Line
              type="monotone"
              dataKey="previous"
              stroke={VIZ.compare}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, fill: VIZ.compare, stroke: VIZ.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="current"
            stroke={VIZ.series}
            strokeWidth={2}
            strokeLinecap="round"
            fill={VIZ.series}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, fill: VIZ.series, stroke: VIZ.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Bar list (breakdowns) ────────────────────────────────────────────────────

export function BarList({
  items,
  total,
  unit,
  empty = "No data for this period",
  limit = 8,
}: {
  items: Array<{ key: string; label: ReactNode; value: number; icon?: ReactNode; title?: string }>;
  /** Denominator for percentages; defaults to the sum of values */
  total?: number;
  unit: string;
  empty?: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const sum = total ?? items.reduce((a, i) => a + i.value, 0);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <div>
      <ul className="space-y-3">
        {shown.map((item) => {
          const pct = sum ? Math.min((item.value / sum) * 100, 100) : 0;
          return (
            <li key={item.key} className="group" title={item.title ?? `${item.value.toLocaleString()} ${unit} · ${pct.toFixed(1)}%`}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {item.icon && <span className="shrink-0 text-muted-foreground">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{item.value.toLocaleString()}</span>
                  <span className="ml-2 inline-block w-11 text-right text-xs text-muted-foreground">{pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5">
                <div
                  className="h-full rounded-r-[4px] transition-[filter] group-hover:brightness-125"
                  style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%`, background: VIZ.series }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

// ─── Heatmap (weekday × hour) ─────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Heatmap({ cells }: { cells: Report["heatmap"] }) {
  const [hover, setHover] = useState<{ d: number; h: number; n: number } | null>(null);
  const grid = useMemo(() => {
    const m = new Map(cells.map((c) => [`${c.d}-${c.h}`, c.n]));
    return DAYS.map((_, di) => Array.from({ length: 24 }, (_, h) => m.get(`${di + 1}-${h}`) ?? 0));
  }, [cells]);
  const max = Math.max(1, ...cells.map((c) => c.n));
  const busiest = cells.reduce<{ d: number; h: number; n: number } | null>((best, c) => (!best || c.n > best.n ? c : best), null);
  const colour = (n: number) => (n === 0 ? VIZ.empty : VIZ.ramp[Math.min(VIZ.ramp.length - 1, Math.ceil((n / max) * VIZ.ramp.length) - 1)]);
  const describe = (c: { d: number; h: number; n: number }) =>
    `${DAYS[c.d - 1]} ${String(c.h).padStart(2, "0")}:00–${String((c.h + 1) % 24).padStart(2, "0")}:00 · ${c.n.toLocaleString()} page view${c.n === 1 ? "" : "s"}`;

  return (
    <div>
      <p className="mb-3 h-4 text-xs text-muted-foreground" aria-live="polite">
        {hover ? describe(hover) : busiest ? <>Busiest: {describe(busiest)}</> : "No visits in this period"}
      </p>
      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[2px]" onMouseLeave={() => setHover(null)}>
          {grid.map((row, di) => (
            <div key={DAYS[di]} className="contents">
              <span className="pr-2 text-right text-[10px] leading-[18px] text-muted-foreground">{DAYS[di]}</span>
              {row.map((n, h) => (
                <span
                  key={h}
                  role="img"
                  aria-label={describe({ d: di + 1, h, n })}
                  tabIndex={-1}
                  onMouseEnter={() => setHover({ d: di + 1, h, n })}
                  className="h-[18px] rounded-[3px] transition-[filter] hover:brightness-150"
                  style={{ background: colour(n) }}
                />
              ))}
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="pt-1 text-center text-[9px] text-muted-foreground">
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        Less
        {VIZ.ramp.map((c) => (
          <span key={c} className="h-2.5 w-4 rounded-[3px]" style={{ background: c }} />
        ))}
        More
      </div>
    </div>
  );
}

// ─── Split meter (new vs returning, device share…) ────────────────────────────

export function SplitMeter({ a, b, aLabel, bLabel }: { a: number; b: number; aLabel: string; bLabel: string }) {
  const total = a + b;
  const pa = total ? (a / total) * 100 : 0;
  return (
    <div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        {total === 0 ? (
          <span className="h-full w-full" style={{ background: VIZ.empty }} />
        ) : (
          <>
            {a > 0 && <span className="h-full" style={{ width: `${pa}%`, background: VIZ.series }} />}
            {b > 0 && <span className="h-full flex-1" style={{ background: VIZ.ramp[0] }} />}
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: VIZ.series }} />
          {aLabel} <span className="font-semibold tabular-nums">{Math.round(pa)}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: VIZ.ramp[0] }} />
          {bLabel} <span className="font-semibold tabular-nums">{total ? 100 - Math.round(pa) : 0}%</span>
        </span>
      </div>
    </div>
  );
}
