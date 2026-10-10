import { supabase } from "../../../lib/supabase";

// ─── Types (shape returned by supabase/sql/02_analytics.sql) ──────────────────

export type Totals = {
  pageviews: number;
  visitors: number;
  sessions: number;
  new_visitors: number;
  avg_duration_s: number;
  engaged_sessions: number;
  converted_sessions: number;
  enquiries: number;
  whatsapp_clicks: number;
  contact_clicks: number;
};

export type SeriesPoint = { t: string; pageviews: number; visitors: number; sessions: number; enquiries: number };
export type Breakdown = { label: string; value: number; visitors?: number; country?: string };

export type VisitorRow = {
  visitor_id: string;
  sessions: number;
  pageviews: number;
  duration_s: number;
  first_seen: string;
  last_seen: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  ip: string | null;
  converted: boolean;
  contact_clicks: number;
};

export type IpDevice = { device: string | null; browser: string | null; os: string | null; visits: number };

/** One row per IP address (key falls back to "id:<visitor>" when no IP was stored) */
export type IpRow = {
  key: string;
  ip: string | null;
  network: string | null;
  visits: number;
  pageviews: number;
  browsers: number;
  duration_s: number;
  first_seen: string;
  last_seen: string;
  city: string | null;
  country: string | null;
  latest_visitor_id: string;
  converted: boolean;
  contact_clicks: number;
  is_bot: boolean;
  devices: IpDevice[];
};

export type Report = {
  bucket: "hour" | "day" | "month";
  tz: string;
  totals: Totals;
  previous: Totals;
  series: SeriesPoint[];
  previous_series: Omit<SeriesPoint, "t">[];
  sources: Breakdown[];
  campaigns: Breakdown[];
  pages: Breakdown[];
  countries: Breakdown[];
  cities: Breakdown[];
  devices: Breakdown[];
  browsers: Breakdown[];
  os: Breakdown[];
  sections: Breakdown[];
  actions: Breakdown[];
  interest: Array<{ label: string; requests: number; enquiries: number }>;
  heatmap: Array<{ d: number; h: number; n: number }>;
  visitors: VisitorRow[];
  /** Added by supabase/sql/03 — absent on older installs */
  ips?: IpRow[];
  networks?: Breakdown[];
  bots?: number;
  hide_bots?: boolean;
  active_now: number;
  /** Set by the dashboard when the database predates 03 (no IP grouping / bot filter yet) */
  legacy?: boolean;
};

export type LiveEvent = {
  t: string;
  visitor_id: string;
  ip?: string | null;
  type: "pageview" | "event";
  name: string | null;
  props: Record<string, string> | null;
  device: string | null;
  city: string | null;
  country: string | null;
};

export type Live = { active: number; recent: LiveEvent[] };

export type VisitorEvent = {
  t: string;
  session_id: string;
  visitor_id?: string;
  network?: string | null;
  type: "pageview" | "event" | "engagement";
  name: string | null;
  path: string | null;
  props: Record<string, string> | null;
  duration_s: number | null;
  scroll_pct: number | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  screen: string | null;
  language: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  ip: string | null;
  source: string | null;
  campaign: string | null;
};

export type VisitorDetail = {
  ip?: string;
  network?: string | null;
  is_bot?: boolean;
  browsers?: number;
  visitor_id: string;
  first_seen: string | null;
  last_seen: string | null;
  sessions: number;
  pageviews: number;
  ips: string[];
  events: VisitorEvent[];
};

// ─── Ranges ───────────────────────────────────────────────────────────────────

export type RangeKey = "24h" | "7d" | "30d" | "90d" | "12m";

export const RANGES: Array<{ key: RangeKey; label: string; long: string }> = [
  { key: "24h", label: "24h", long: "last 24 hours" },
  { key: "7d", label: "7 days", long: "last 7 days" },
  { key: "30d", label: "30 days", long: "last 30 days" },
  { key: "90d", label: "90 days", long: "last 90 days" },
  { key: "12m", label: "12 months", long: "last 12 months" },
];

export function rangeFor(key: RangeKey): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  const startOfDay = (daysAgo: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  switch (key) {
    case "24h":
      return { from: new Date(now.getTime() - 24 * 3600_000), to };
    case "7d":
      return { from: startOfDay(6), to };
    case "30d":
      return { from: startOfDay(29), to };
    case "90d":
      return { from: startOfDay(89), to };
    case "12m":
      return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to };
  }
}

// ─── Fetching ─────────────────────────────────────────────────────────────────

/** Thrown when supabase/sql/02_analytics.sql hasn't been run yet. */
export class AnalyticsNotInstalled extends Error {}

function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "")) {
    throw new AnalyticsNotInstalled("Analytics isn't installed yet");
  }
  throw new Error(error.message ?? "Couldn't load analytics");
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Windhoek";
  } catch {
    return "Africa/Windhoek";
  }
}

const isMissingFunction = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "PGRST202" || /could not find the function/i.test(error.message ?? ""));

export async function fetchReport(key: RangeKey, hideBots = true): Promise<Report> {
  const { from, to } = rangeFor(key);
  const args = { p_from: from.toISOString(), p_to: to.toISOString(), p_tz: browserTimeZone() };
  const { data, error } = await supabase.rpc("analytics_report", { ...args, p_hide_bots: hideBots });
  if (!isMissingFunction(error)) {
    check(error);
    return data as Report;
  }
  // Database predates 03_analytics_ip_grouping.sql — fall back to the original report
  const legacy = await supabase.rpc("analytics_report", args);
  check(legacy.error);
  return { ...(legacy.data as Report), legacy: true };
}

export async function fetchLive(hideBots = true): Promise<Live> {
  const { data, error } = await supabase.rpc("analytics_live", { p_hide_bots: hideBots });
  if (!isMissingFunction(error)) {
    check(error);
    return data as Live;
  }
  const legacy = await supabase.rpc("analytics_live");
  check(legacy.error);
  return legacy.data as Live;
}

export async function fetchIp(ip: string): Promise<VisitorDetail> {
  const { data, error } = await supabase.rpc("analytics_ip", { p_ip: ip });
  if (isMissingFunction(error)) throw new Error("Run supabase/sql/03_analytics_ip_grouping.sql to see per-IP history.");
  check(error);
  return data as VisitorDetail;
}

export async function forgetIp(ip: string) {
  const { error } = await supabase.from("analytics_events").delete().eq("ip", ip);
  if (error) throw new Error(error.message);
}

// ─── Excluded IPs (never recorded) ───────────────────────────────────────────

export type ExcludedIp = { ip: string; label: string | null; created_at: string };

/** null = the database predates supabase/sql/03 (feature unavailable) */
export async function fetchExcludedIps(): Promise<ExcludedIp[] | null> {
  const { data, error } = await supabase.from("analytics_excluded_ips").select("*").order("created_at", { ascending: false });
  if (error) return null;
  return data as ExcludedIp[];
}

/** The IP the database sees for this browser right now */
export async function fetchMyIp(): Promise<string | null> {
  const { data, error } = await supabase.rpc("analytics_my_ip");
  return error ? null : ((data as string) || null);
}

/** Stop recording an IP and delete what's already been recorded from it. Returns rows deleted. */
export async function excludeIp(ip: string, label?: string): Promise<number> {
  const { data, error } = await supabase.rpc("analytics_exclude_ip", { p_ip: ip.trim(), p_label: label ?? null });
  if (error) throw new Error(isMissingFunction(error) ? "Run supabase/sql/03_analytics_ip_grouping.sql first." : error.message);
  return (data as number) ?? 0;
}

export async function includeIp(ip: string) {
  const { error } = await supabase.from("analytics_excluded_ips").delete().eq("ip", ip);
  if (error) throw new Error(error.message);
}

/**
 * Visits recorded before v2.3.0 have no network name. Look the IPs up (same
 * service visitors' browsers already use) and store the result so the bot
 * filter can classify them. Returns how many rows were updated.
 */
export async function labelNetworks(ips: string[]): Promise<number> {
  const batch = [...new Set(ips)].slice(0, 100);
  if (batch.length === 0) return 0;
  const res = await fetch(`https://get.geojs.io/v1/ip/geo.json?ip=${batch.map(encodeURIComponent).join(",")}`);
  if (!res.ok) return 0;
  const raw = await res.json();
  const list: Array<{ ip?: string; organization_name?: string }> = Array.isArray(raw) ? raw : [raw];
  const items = batch.map((ip) => ({ ip, network: list.find((x) => x.ip === ip)?.organization_name ?? "" }));
  const { data, error } = await supabase.rpc("analytics_set_networks", { p_items: items });
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function fetchVisitor(visitorId: string): Promise<VisitorDetail> {
  const { data, error } = await supabase.rpc("analytics_visitor", { p_visitor_id: visitorId });
  check(error);
  return data as VisitorDetail;
}

export async function forgetVisitor(visitorId: string) {
  const { error } = await supabase.from("analytics_events").delete().eq("visitor_id", visitorId);
  if (error) throw new Error(error.message);
}

// ─── Labels & formatting ──────────────────────────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  contact_submit: "Enquiries sent",
  whatsapp_click: "WhatsApp clicks",
  phone_click: "Phone clicks",
  email_click: "Email clicks",
  service_request: "Service / package buttons",
  cta_click: "“Get a quote” clicks",
  faq_open: "FAQ questions opened",
  project_view: "Portfolio projects opened",
  currency_toggle: "Currency switched",
  outbound_click: "Outbound links",
  contact_invalid: "Contact form errors",
};

/** Past-tense phrasing for the live activity feed */
export const LIVE_LABELS: Record<string, string> = {
  contact_submit: "sent an enquiry",
  whatsapp_click: "opened WhatsApp",
  phone_click: "tapped the phone number",
  email_click: "clicked the email address",
  service_request: "picked a service or package",
  cta_click: "clicked “Get a quote”",
  faq_open: "read an FAQ answer",
  project_view: "opened a portfolio project",
  currency_toggle: "switched currency",
  outbound_click: "followed an outside link",
  contact_invalid: "hit a contact form error",
};

/** "Package: Website Starter" → "Website Starter package" */
export function serviceLabel(service: string | null | undefined): string {
  if (!service) return "";
  return service.startsWith("Package: ") ? `${service.slice(9)} package` : service;
}

/** Landing page sections, top to bottom */
export const SECTION_ORDER: Array<[string, string]> = [
  ["top", "Hero"],
  ["services", "Services"],
  ["process", "How it works"],
  ["pricing", "Pricing"],
  ["portfolio", "Portfolio"],
  ["testimonials", "Testimonials"],
  ["about", "About"],
  ["faq", "FAQ"],
  ["contact", "Contact form"],
];

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryName(code: string | null | undefined): string {
  if (!code || code === "??") return "Unknown";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

/** Percentage change vs previous period; null when there's nothing to compare against. */
export function change(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

/** Parse the report's local "YYYY-MM-DDTHH:MM" bucket label without timezone shifts. */
export function parseBucket(t: string): Date {
  const [d, time = "00:00"] = t.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, day, hh, mm);
}

export function bucketLabel(t: string, bucket: Report["bucket"], long = false): string {
  const date = parseBucket(t);
  if (bucket === "hour") return date.toLocaleString("en-ZA", long ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" });
  if (bucket === "month") return date.toLocaleDateString("en-ZA", long ? { month: "long", year: "numeric" } : { month: "short" });
  return date.toLocaleDateString("en-ZA", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

// Friendly, stable names for anonymous visitors ("Swift Kudu"), so regulars are recognisable
const ADJECTIVES = ["Amber", "Azure", "Bold", "Brisk", "Calm", "Clever", "Coral", "Crimson", "Dusty", "Eager", "Gentle", "Golden", "Jade", "Lively", "Lucky", "Misty", "Noble", "Quiet", "Rapid", "Rustic", "Silver", "Sunny", "Swift", "Velvet"];
const ANIMALS = ["Antelope", "Badger", "Cheetah", "Crane", "Dolphin", "Eagle", "Falcon", "Fox", "Gecko", "Heron", "Ibis", "Jackal", "Kudu", "Lion", "Lynx", "Meerkat", "Oryx", "Otter", "Owl", "Panther", "Rhino", "Springbok", "Wolf", "Zebra"];

export function visitorName(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h >>>= 0;
  return `${ADJECTIVES[h % ADJECTIVES.length]} ${ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length]}`;
}

export function visitorTag(id: string): string {
  return id.slice(0, 4).toUpperCase();
}
