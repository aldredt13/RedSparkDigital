import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  Eye,
  Flame,
  Globe,
  Laptop,
  Layers,
  Link2,
  Loader2,
  MapPin,
  MessageSquareText,
  MousePointerClick,
  Package,
  Search,
  ShieldCheck,
  Smartphone,
  Table2,
  Tablet,
  Users,
} from "lucide-react";
import { EXCLUDE_KEY } from "../../lib/analytics";
import { cn } from "../../lib/utils";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Segmented, Skeleton, Switch } from "./ui";
import { downloadCsv, relativeTime } from "./utils";
import {
  ACTION_LABELS,
  AnalyticsNotInstalled,
  LIVE_LABELS,
  RANGES,
  SECTION_ORDER,
  bucketLabel,
  change,
  compact,
  countryName,
  fetchLive,
  fetchReport,
  formatDuration,
  serviceLabel,
  visitorName,
  visitorTag,
  type Live,
  type RangeKey,
  type Report,
} from "./analytics/api";
import { BarList, Heatmap, SplitMeter, TrafficChart } from "./analytics/charts";
import { StatTile } from "./analytics/mini";
import { METRIC_LABELS, VIZ, type Metric } from "./analytics/viz";
import { DeviceIcon, VisitorDrawer } from "./analytics/VisitorDrawer";

const RANGE_STORAGE = "rsd:analytics-range";

function readExcluded() {
  try {
    return localStorage.getItem(EXCLUDE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function AnalyticsPanel() {
  const [range, setRange] = useState<RangeKey>(() => {
    try {
      return (localStorage.getItem(RANGE_STORAGE) as RangeKey) || "30d";
    } catch {
      return "30d";
    }
  });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [live, setLive] = useState<Live | null>(null);

  const [metric, setMetric] = useState<Metric>("visitors");
  const [compare, setCompare] = useState(true);
  const [tableView, setTableView] = useState(false);
  const [sourceTab, setSourceTab] = useState<"sources" | "campaigns">("sources");
  const [placeTab, setPlaceTab] = useState<"countries" | "cities">("countries");
  const [techTab, setTechTab] = useState<"browsers" | "os">("browsers");
  const [visitorQuery, setVisitorQuery] = useState("");
  const [openVisitor, setOpenVisitor] = useState<string | null>(null);
  const [excluded, setExcluded] = useState(readExcluded);

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchReport(key));
      setUpdatedAt(new Date());
      setNotInstalled(false);
    } catch (e) {
      if (e instanceof AnalyticsNotInstalled) setNotInstalled(true);
      else setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
    try {
      localStorage.setItem(RANGE_STORAGE, range);
    } catch {
      /* ignore */
    }
  }, [range, load]);

  // Live visitors every 20s; full report refresh every 2 minutes (while the tab is visible)
  useEffect(() => {
    if (notInstalled) return;
    const pollLive = () => !document.hidden && fetchLive().then(setLive).catch(() => {});
    pollLive();
    const liveTimer = window.setInterval(pollLive, 20_000);
    const reportTimer = window.setInterval(() => !document.hidden && load(range), 120_000);
    return () => {
      window.clearInterval(liveTimer);
      window.clearInterval(reportTimer);
    };
  }, [notInstalled, range, load]);

  function toggleSelf(countMe: boolean) {
    try {
      localStorage.setItem(EXCLUDE_KEY, countMe ? "0" : "1");
    } catch {
      /* ignore */
    }
    setExcluded(!countMe);
  }

  const rangeInfo = RANGES.find((r) => r.key === range)!;

  if (notInstalled) {
    return (
      <>
        <PageHeader title="Analytics" description="Traffic, visitors and conversions for the website." />
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Analytics isn't switched on yet"
          description="Run supabase/sql/02_analytics.sql in the Supabase SQL editor (after 01_security_and_notifications.sql). Visits start appearing here as soon as people browse the site."
          action={
            <Button onClick={() => load(range)} icon={<Activity className="h-4 w-4" />}>
              Check again
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How people find and use the site — first-party data, no third-party trackers."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {live ? `${live.active} on the site now` : "Live"}
          </span>
        }
      />

      {/* Filters — one row, scopes everything below */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented label="Date range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.key, label: r.label }))} />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={compare} onChange={setCompare} ariaLabel="Compare with previous period" />
          Compare with previous period
        </label>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {updatedAt && `Updated ${updatedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`}
        </span>
      </div>

      {error && !report && (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Couldn't load analytics"
          description={error}
          action={<Button onClick={() => load(range)}>Try again</Button>}
        />
      )}

      {!report && loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      )}

      {report && (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          <Kpis report={report} />

          {/* Traffic over time */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-sans text-sm font-semibold tracking-normal">{METRIC_LABELS[metric]} over time</h2>
                <GrowthSentence report={report} metric={metric} rangeLong={rangeInfo.long} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Metric"
                  value={metric}
                  onChange={setMetric}
                  options={(Object.keys(METRIC_LABELS) as Metric[]).map((m) => ({ value: m, label: METRIC_LABELS[m] }))}
                />
                <Button size="sm" variant={tableView ? "secondary" : "ghost"} icon={<Table2 className="h-3.5 w-3.5" />} onClick={() => setTableView((v) => !v)}>
                  {tableView ? "Chart" : "Table"}
                </Button>
              </div>
            </div>
            <div className="px-3 pb-4 pt-4 sm:px-5">
              {compare && !tableView && (
                <div className="mb-2 flex items-center gap-4 pl-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full" style={{ background: VIZ.series }} /> This period
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded-full" style={{ background: VIZ.compare }} /> Previous period
                  </span>
                </div>
              )}
              {tableView ? <SeriesTable report={report} metric={metric} compare={compare} /> : <TrafficChart report={report} metric={metric} showPrevious={compare} />}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader
                icon={<Link2 className="h-4 w-4" />}
                title="Where visitors come from"
                description="Visits by referring site or campaign"
                actions={
                  report.campaigns.length > 0 ? (
                    <Segmented
                      label="Source type"
                      value={sourceTab}
                      onChange={setSourceTab}
                      options={[
                        { value: "sources", label: "Sources" },
                        { value: "campaigns", label: "Campaigns" },
                      ]}
                    />
                  ) : undefined
                }
              />
              <div className="p-5">
                <BarList
                  unit="visits"
                  total={report.totals.sessions}
                  items={(sourceTab === "campaigns" ? report.campaigns : report.sources).map((s) => ({ key: s.label, label: s.label, value: s.value }))}
                />
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Tip: add <code className="rounded bg-secondary px-1">?utm_source=facebook&amp;utm_campaign=promo</code> to links you share to track campaigns.
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<MapPin className="h-4 w-4" />}
                title="Locations"
                description="Visitors by approximate location"
                actions={
                  <Segmented
                    label="Location type"
                    value={placeTab}
                    onChange={setPlaceTab}
                    options={[
                      { value: "countries", label: "Countries" },
                      { value: "cities", label: "Cities" },
                    ]}
                  />
                }
              />
              <div className="p-5">
                <BarList
                  unit="visitors"
                  total={report.totals.visitors}
                  items={
                    placeTab === "countries"
                      ? report.countries.map((c) => ({ key: c.label, label: countryName(c.label), value: c.value, icon: <Globe className="h-3.5 w-3.5" /> }))
                      : report.cities.map((c) => ({ key: `${c.label}-${c.country}`, label: `${c.label}, ${countryName(c.country)}`, value: c.value, icon: <MapPin className="h-3.5 w-3.5" /> }))
                  }
                />
              </div>
            </Card>

            <Card>
              <CardHeader icon={<Users className="h-4 w-4" />} title="Audience" description="Devices and loyalty" />
              <div className="space-y-6 p-5">
                <BarList
                  unit="visitors"
                  total={report.totals.visitors}
                  items={report.devices.map((d) => ({
                    key: d.label,
                    label: <span className="capitalize">{d.label}</span>,
                    value: d.value,
                    icon: d.label === "mobile" ? <Smartphone className="h-3.5 w-3.5" /> : d.label === "tablet" ? <Tablet className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />,
                  }))}
                />
                <div>
                  <p className="mb-2 text-xs font-semibold">New vs returning visitors</p>
                  <SplitMeter
                    a={report.totals.new_visitors}
                    b={Math.max(0, report.totals.visitors - report.totals.new_visitors)}
                    aLabel="New"
                    bLabel="Returning"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon={<Laptop className="h-4 w-4" />}
                title="Browsers & systems"
                actions={
                  <Segmented
                    label="Technology"
                    value={techTab}
                    onChange={setTechTab}
                    options={[
                      { value: "browsers", label: "Browsers" },
                      { value: "os", label: "OS" },
                    ]}
                  />
                }
              />
              <div className="p-5">
                <BarList
                  unit="visitors"
                  total={report.totals.visitors}
                  items={(techTab === "browsers" ? report.browsers : report.os).map((b) => ({ key: b.label, label: b.label, value: b.value }))}
                />
              </div>
            </Card>

            <Card>
              <CardHeader icon={<Layers className="h-4 w-4" />} title="How far visitors scroll" description="Share of visits that reached each section" />
              <div className="p-5">
                <BarList
                  unit="visits"
                  total={report.totals.sessions}
                  limit={9}
                  items={SECTION_ORDER.flatMap(([id, name]) => {
                    const hit = report.sections.find((s) => s.label === id);
                    return hit ? [{ key: id, label: name, value: hit.value }] : [];
                  })}
                />
              </div>
            </Card>

            <Card>
              <CardHeader icon={<MousePointerClick className="h-4 w-4" />} title="Actions" description="What visitors did on the site" />
              <div className="p-5">
                <BarList
                  unit="times"
                  items={report.actions.map((a) => ({
                    key: a.label,
                    label: ACTION_LABELS[a.label] ?? a.label,
                    value: a.value,
                    title: `${a.value.toLocaleString()} times by ${a.visitors ?? 0} visitor${a.visitors === 1 ? "" : "s"}`,
                  }))}
                />
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader icon={<Flame className="h-4 w-4" />} title="When visitors come" description={`Page views by weekday and hour (${report.tz})`} />
              <div className="p-5">
                <Heatmap cells={report.heatmap} />
              </div>
            </Card>

            <Card>
              <CardHeader icon={<Package className="h-4 w-4" />} title="Service & package interest" description="Button clicks vs enquiries sent" />
              <div className="p-5">
                {report.interest.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No service or package clicks yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="pb-2 font-semibold">Service / package</th>
                        <th className="pb-2 text-right font-semibold">Clicks</th>
                        <th className="pb-2 text-right font-semibold">Enquiries</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {report.interest.map((r) => (
                        <tr key={r.label}>
                          <td className="py-2 pr-2">{serviceLabel(r.label)}</td>
                          <td className="py-2 text-right tabular-nums">{r.requests}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{r.enquiries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2 xl:col-span-3">
              <CardHeader icon={<Activity className="h-4 w-4" />} title="Live activity" description="Last 30 minutes · updates every 20 seconds" />
              <div className="p-5">
                {!live || live.recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nobody's been on the site in the last 30 minutes.</p>
                ) : (
                  <ul className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
                    {live.recent.map((e, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                          <DeviceIcon device={e.device} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <button type="button" className="font-semibold hover:text-primary" onClick={() => setOpenVisitor(e.visitor_id)}>
                            {visitorName(e.visitor_id)}
                          </button>{" "}
                          <span className="text-muted-foreground">
                            {e.type === "pageview" ? "opened the site" : (LIVE_LABELS[e.name ?? ""] ?? e.name)}
                            {e.city ? ` · ${e.city}` : e.country ? ` · ${countryName(e.country)}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(e.t)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          <VisitorsTable report={report} query={visitorQuery} onQuery={setVisitorQuery} onOpen={setOpenVisitor} />

          <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Visitors are identified by a random ID stored in their browser — no cookies or third-party trackers. IP addresses are deleted after 90 days and
                all visit data after 13 months. Browsers that send “Do Not Track” or Global Privacy Control aren't tracked.
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-3 text-sm">
              <span>
                <span className="block font-medium">Count my own visits</span>
                <span className="block text-xs text-muted-foreground">{excluded ? "This browser is excluded" : "This browser is counted"}</span>
              </span>
              <Switch checked={!excluded} onChange={toggleSelf} ariaLabel="Count my own visits" />
            </label>
          </div>
        </div>
      )}

      {openVisitor && (
        <VisitorDrawer
          visitorId={openVisitor}
          onClose={() => setOpenVisitor(null)}
          onForgotten={() => {
            setOpenVisitor(null);
            load(range);
          }}
        />
      )}
    </>
  );
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function Kpis({ report }: { report: Report }) {
  const t = report.totals;
  const p = report.previous;
  const engagement = t.sessions ? (t.engaged_sessions / t.sessions) * 100 : 0;
  const prevEngagement = p.sessions ? (p.engaged_sessions / p.sessions) * 100 : 0;
  const conversion = t.sessions ? (t.converted_sessions / t.sessions) * 100 : 0;
  const returning = Math.max(0, t.visitors - t.new_visitors);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Visitors"
        icon={<Users className="h-3.5 w-3.5" />}
        value={compact(t.visitors)}
        delta={change(t.visitors, p.visitors)}
        hint={`${t.new_visitors} new · ${returning} returning`}
        trend={report.series.map((s) => s.visitors)}
      />
      <StatTile
        label="Page views"
        icon={<Eye className="h-3.5 w-3.5" />}
        value={compact(t.pageviews)}
        delta={change(t.pageviews, p.pageviews)}
        hint={`${t.sessions.toLocaleString()} visits`}
        trend={report.series.map((s) => s.pageviews)}
      />
      <StatTile
        label="Avg. time on site"
        icon={<Clock className="h-3.5 w-3.5" />}
        value={formatDuration(t.avg_duration_s)}
        delta={change(t.avg_duration_s, p.avg_duration_s)}
        hint="Active time per visit"
      />
      <StatTile
        label="Engagement"
        icon={<Activity className="h-3.5 w-3.5" />}
        value={`${Math.round(engagement)}%`}
        delta={p.sessions ? engagement - prevEngagement : null}
        deltaUnit=" pts"
        hint="Visits over 10s or with a click"
      />
      <StatTile
        label="Enquiries"
        icon={<MessageSquareText className="h-3.5 w-3.5" />}
        value={compact(t.enquiries)}
        delta={change(t.enquiries, p.enquiries)}
        hint={`${conversion.toFixed(1)}% of visits`}
        trend={report.series.map((s) => s.enquiries)}
      />
      <StatTile
        label="Contact clicks"
        icon={<MousePointerClick className="h-3.5 w-3.5" />}
        value={compact(t.contact_clicks)}
        delta={change(t.contact_clicks, p.contact_clicks)}
        hint={`${t.whatsapp_clicks} on WhatsApp`}
      />
    </div>
  );
}

function GrowthSentence({ report, metric, rangeLong }: { report: Report; metric: Metric; rangeLong: string }) {
  const key = metric === "sessions" ? "sessions" : metric;
  const now = report.totals[key];
  const before = report.previous[key];
  const pct = change(now, before);
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{now.toLocaleString()}</span> {METRIC_LABELS[metric].toLowerCase()} in the {rangeLong}
      {pct === null ? " — no data for the previous period" : pct === 0 ? ", same as the previous period" : `, ${pct > 0 ? "up" : "down"} ${Math.abs(Math.round(pct))}% on the previous period (${before.toLocaleString()})`}
    </p>
  );
}

function SeriesTable({ report, metric, compare }: { report: Report; metric: Metric; compare: boolean }) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">{report.bucket === "hour" ? "Hour" : report.bucket === "month" ? "Month" : "Day"}</th>
            <th className="px-3 py-2 text-right font-semibold">{METRIC_LABELS[metric]}</th>
            {compare && <th className="px-3 py-2 text-right font-semibold">Previous period</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40 tabular-nums">
          {[...report.series].reverse().map((p, ri) => {
            const i = report.series.length - 1 - ri;
            return (
              <tr key={p.t}>
                <td className="px-3 py-1.5">{bucketLabel(p.t, report.bucket, true)}</td>
                <td className="px-3 py-1.5 text-right font-semibold">{p[metric].toLocaleString()}</td>
                {compare && <td className="px-3 py-1.5 text-right text-muted-foreground">{report.previous_series[i]?.[metric]?.toLocaleString() ?? "—"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Visitors table ───────────────────────────────────────────────────────────

function VisitorsTable({ report, query, onQuery, onOpen }: { report: Report; query: string; onQuery: (q: string) => void; onOpen: (id: string) => void }) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return report.visitors;
    return report.visitors.filter((v) =>
      [visitorName(v.visitor_id), v.visitor_id, v.ip ?? "", v.city ?? "", countryName(v.country), v.browser ?? "", v.os ?? "", v.device ?? ""].some((s) => s.toLowerCase().includes(q)),
    );
  }, [report.visitors, query]);

  function exportCsv() {
    downloadCsv(
      `redspark-visitors-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((v) => ({
        visitor: `${visitorName(v.visitor_id)} (${visitorTag(v.visitor_id)})`,
        visitor_id: v.visitor_id,
        visits: v.sessions,
        page_views: v.pageviews,
        time_on_site: formatDuration(v.duration_s),
        city: v.city ?? "",
        country: countryName(v.country),
        device: v.device ?? "",
        browser: v.browser ?? "",
        os: v.os ?? "",
        ip: v.ip ?? "",
        enquired: v.converted ? "yes" : "no",
        first_seen: v.first_seen,
        last_seen: v.last_seen,
      })),
    );
  }

  return (
    <Card>
      <CardHeader
        icon={<Users className="h-4 w-4" />}
        title="Visitors"
        description="Most active visitors in this period · click one to see their full history"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Name, IP, city…"
                aria-label="Search visitors"
                className="field-input h-8 w-44 py-0 pl-8 text-xs"
              />
            </div>
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} disabled={rows.length === 0}>
              CSV
            </Button>
          </div>
        }
      />
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">{report.visitors.length ? "No visitors match that search." : "No visitors in this period yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-5 py-2.5 font-semibold">Visitor</th>
                <th className="px-3 py-2.5 font-semibold">Location</th>
                <th className="px-3 py-2.5 font-semibold">Device</th>
                <th className="px-3 py-2.5 font-semibold">IP address</th>
                <th className="px-3 py-2.5 text-right font-semibold">Visits</th>
                <th className="px-3 py-2.5 text-right font-semibold">Views</th>
                <th className="px-3 py-2.5 text-right font-semibold">Time</th>
                <th className="px-5 py-2.5 text-right font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((v) => (
                <tr key={v.visitor_id} onClick={() => onOpen(v.visitor_id)} className="cursor-pointer transition-colors hover:bg-secondary/40">
                  <td className="px-5 py-2.5">
                    <button type="button" className="text-left" onClick={() => onOpen(v.visitor_id)}>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{visitorName(v.visitor_id)}</span>
                        <span className="text-[11px] text-muted-foreground">{visitorTag(v.visitor_id)}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {v.converted && <Badge tone="success">Enquired</Badge>}
                        {v.contact_clicks > 0 && <Badge tone="info">Contacted</Badge>}
                        {new Date(v.first_seen) < new Date(Date.now() - 86400000) && v.sessions > 1 && <Badge>Returning</Badge>}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block truncate">{v.city ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">{countryName(v.country)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <DeviceIcon device={v.device} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        <span className="block">{v.browser ?? "—"}</span>
                        <span className="block text-xs text-muted-foreground">{v.os ?? ""}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{v.ip ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{v.sessions}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{v.pageviews}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatDuration(v.duration_s)}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-muted-foreground">{relativeTime(v.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default AnalyticsPanel;
