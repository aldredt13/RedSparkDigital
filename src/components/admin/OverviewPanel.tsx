import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, Bell, CheckCircle2, Circle, DollarSign, Inbox, LayoutGrid, MessageSquareQuote, Plus, TrendingUp } from "lucide-react";
import { isPackageValue, packageName } from "../../lib/site";
import { cn } from "../../lib/utils";
import type { AdminTab, PanelProps } from "./types";
import { Badge, Button, Card, CardHeader, PageHeader, Skeleton } from "./ui";
import { initials, relativeTime } from "./utils";
import { AnalyticsNotInstalled, change, compact, fetchReport, type Report } from "./analytics/api";
import { Delta, Sparkline } from "./analytics/mini";

/** 7-day visitor snapshot for the overview; null = analytics not installed */
function useTrafficSnapshot() {
  const [snapshot, setSnapshot] = useState<Report | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetchReport("7d")
      .then((r) => alive && setSnapshot(r))
      .catch((e) => alive && setSnapshot(e instanceof AnalyticsNotInstalled ? null : undefined));
    return () => {
      alive = false;
    };
  }, []);
  return snapshot;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function OverviewPanel({ data, loading, goTo }: PanelProps) {
  const traffic = useTrafficSnapshot();
  const { submissions, projects, testimonials, plans, features, settings } = data;
  const unread = submissions.filter((s) => s.status === "unread").length;
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = submissions.filter((s) => new Date(s.created_at).getTime() > weekAgo).length;
  const packageLeads = submissions.filter((s) => isPackageValue(s.service)).length;
  const avgRating = testimonials.length ? testimonials.reduce((a, t) => a + t.rating, 0) / testimonials.length : 0;
  const activePlans = plans.filter((p) => p.active).length;

  const webhookSet = !!settings["discord_webhook_url"];
  const notificationsOn = (settings["discord_notifications_enabled"] ?? "true") === "true";
  const socialsSet = ["social_twitter", "social_instagram", "social_github", "social_facebook", "social_linkedin"].some((k) => settings[k]?.trim());

  const stats: Array<{ label: string; value: string | number; sub: string; icon: typeof Inbox; tab: AdminTab; highlight?: boolean }> = [
    { label: "Unread enquiries", value: unread, sub: `${submissions.length} total`, icon: Inbox, tab: "submissions", highlight: unread > 0 },
    { label: "Enquiries this week", value: thisWeek, sub: `${packageLeads} package enquir${packageLeads === 1 ? "y" : "ies"} overall`, icon: TrendingUp, tab: "submissions" },
    { label: "Portfolio projects", value: projects.length, sub: projects.length ? "Live on the site" : "None yet", icon: LayoutGrid, tab: "projects" },
    { label: "Testimonials", value: testimonials.length, sub: testimonials.length ? `${avgRating.toFixed(1)} average rating` : "None yet", icon: MessageSquareQuote, tab: "testimonials" },
    { label: "Active plans", value: activePlans, sub: `${plans.length - activePlans} hidden`, icon: DollarSign, tab: "pricing" },
  ];

  const checklist: Array<{ done: boolean; label: string; detail: string; tab: AdminTab; intent?: string; cta: string }> = [
    { done: webhookSet && notificationsOn, label: "Discord alerts", detail: webhookSet ? (notificationsOn ? "Active" : "Paused") : "Get pinged for every new enquiry", tab: "notifications", cta: webhookSet ? "Manage" : "Set up" },
    { done: projects.length > 0, label: "Portfolio projects", detail: "Visitors currently see “Case studies coming soon”", tab: "projects", intent: "create", cta: "Add project" },
    { done: testimonials.length > 0, label: "Client testimonials", detail: "The reviews section stays hidden until you add one", tab: "testimonials", intent: "create", cta: "Add review" },
    { done: activePlans > 0 && features.length > 0, label: "Pricing packages", detail: "Plans with features listed", tab: "pricing", cta: "Review" },
    { done: traffic !== null, label: "Website analytics", detail: traffic === null ? "Run supabase/sql/02_analytics.sql to start tracking" : "Tracking visits", tab: "analytics", cta: "Set up" },
    { done: socialsSet, label: "Social links", detail: "Show your profiles in the footer", tab: "site", cta: "Add links" },
  ];
  const done = checklist.filter((c) => c.done).length;

  return (
    <>
      <PageHeader
        title={`${greeting()} 👋`}
        description="Here's what's happening on RedSpark Digital."
        actions={
          <>
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => goTo("projects", "create")}>
              Project
            </Button>
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => goTo("testimonials", "create")}>
              Testimonial
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <button
          type="button"
          onClick={() => goTo("analytics")}
          className="group flex flex-col rounded-2xl border border-sky-500/30 bg-sky-500/[0.07] p-4 text-left transition-colors hover:border-sky-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
              <BarChart3 className="h-4 w-4" />
            </span>
            {traffic && <Delta value={change(traffic.totals.visitors, traffic.previous.visitors)} />}
          </div>
          {traffic === undefined ? (
            <Skeleton className="mt-4 h-7 w-12" />
          ) : (
            <p className="mt-3 font-display text-2xl font-bold tabular-nums">{traffic ? compact(traffic.totals.visitors) : "—"}</p>
          )}
          <p className="mt-0.5 text-xs font-medium">Visitors · 7 days</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {traffic === null ? "Set up analytics →" : traffic ? `${traffic.totals.pageviews.toLocaleString()} page views` : "…"}
          </p>
          {traffic && <Sparkline values={traffic.series.map((s) => s.visitors)} className="mt-2" />}
        </button>
        {stats.map(({ label, value, sub, icon: Icon, tab, highlight }) => (
          <button
            key={label}
            type="button"
            onClick={() => goTo(tab)}
            className={cn(
              "group rounded-2xl border p-4 text-left transition-colors",
              highlight ? "border-primary/40 bg-primary/10 hover:border-primary/60" : "border-border/70 bg-card/60 hover:border-border",
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", highlight ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                <Icon className="h-4 w-4" />
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {loading ? <Skeleton className="mt-4 h-7 w-12" /> : <p className="mt-3 font-display text-2xl font-bold tabular-nums">{value}</p>}
            <p className="mt-0.5 text-xs font-medium">{label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{loading ? "…" : sub}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            icon={<Inbox className="h-4 w-4" />}
            title="Latest enquiries"
            description="Newest contact form submissions"
            actions={
              <Button size="sm" variant="ghost" onClick={() => goTo("submissions")}>
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            }
          />
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No enquiries yet — they'll show up here as soon as someone uses the contact form.</p>
          ) : (
            <ul className="divide-y divide-border/50">
              {submissions.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => goTo("submissions", `open:${s.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/40">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", s.status === "unread" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                      {initials(s.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm", s.status === "unread" ? "font-semibold" : "font-medium text-foreground/80")}>{s.name}</span>
                        {s.status === "unread" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{packageName(s.service) ? `📦 ${packageName(s.service)}` : s.service}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(s.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Site checklist"
            description={`${done} of ${checklist.length} complete`}
            actions={<Badge tone={done === checklist.length ? "success" : "neutral"}>{Math.round((done / checklist.length) * 100)}%</Badge>}
          />
          <div className="px-5 pt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-(image:--gradient-primary) transition-all duration-500" style={{ width: `${(done / checklist.length) * 100}%` }} />
            </div>
          </div>
          <ul className="space-y-1 p-3">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                {c.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />}
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", c.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{c.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.detail}</span>
                </span>
                {!c.done && !loading && (
                  <Button size="sm" variant="ghost" onClick={() => goTo(c.tab, c.intent)}>
                    {c.cta}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {webhookSet && !notificationsOn && (
            <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <Bell className="h-3.5 w-3.5" /> Discord alerts are paused.
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
