// Lightweight chart pieces (no recharts) so the Overview tab can use them
// without pulling the full charting library into the main admin bundle.
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "../../../lib/utils";
import { VIZ } from "./viz";

// ─── Delta ────────────────────────────────────────────────────────────────────

export function Delta({ value, goodWhenUp = true, unit = "%", className }: { value: number | null; goodWhenUp?: boolean; unit?: string; className?: string }) {
  if (value === null) return <span className={cn("text-xs text-muted-foreground", className)}>new</span>;
  const rounded = Math.round(value);
  if (rounded === 0)
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground", className)}>
        <Minus className="h-3 w-3" /> 0{unit}
      </span>
    );
  const up = rounded > 0;
  const good = up === goodWhenUp;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-emerald-400" : "text-red-400", className)}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? "+" : ""}
      {rounded}
      {unit}
    </span>
  );
}

// ─── Sparkline (stat tiles) ───────────────────────────────────────────────────

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full overflow-visible", className)} aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={VIZ.series} fillOpacity={0.1} />
      <path d={d} fill="none" stroke={VIZ.compare} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  delta,
  goodWhenUp,
  deltaUnit,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: ReactNode;
  delta: number | null;
  goodWhenUp?: boolean;
  deltaUnit?: string;
  hint?: string;
  trend?: number[];
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border/70 bg-card/60 p-4">
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight">
        {value}
        <Delta value={delta} goodWhenUp={goodWhenUp} unit={deltaUnit} />
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {trend && <Sparkline values={trend} className="mt-auto pt-3" />}
    </div>
  );
}
