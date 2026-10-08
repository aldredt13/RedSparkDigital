/**
 * Chart tokens. Validated with the dataviz palette checker against the admin
 * card surface (#1c0d0d, dark): series blue passes band/chroma/contrast; the
 * heatmap ramp passes the ordinal checks (monotone, ΔL ≥ 0.06, light end ≥ 2:1).
 * Red is deliberately not used for data — it reads as "bad" and is the brand/alert colour.
 */
export const VIZ = {
  surface: "#1c0d0d",
  series: "#3987e5",
  compare: "#898781",
  grid: "rgba(255,255,255,0.07)",
  baseline: "rgba(255,255,255,0.16)",
  muted: "#a59a9a",
  ramp: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"],
  empty: "rgba(255,255,255,0.045)",
};

export type Metric = "visitors" | "pageviews" | "sessions" | "enquiries";

export const METRIC_LABELS: Record<Metric, string> = {
  visitors: "Visitors",
  pageviews: "Page views",
  sessions: "Visits",
  enquiries: "Enquiries",
};
