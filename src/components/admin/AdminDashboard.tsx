import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Toaster, toast } from "sonner";
import {
  BarChart3,
  Bell,
  DollarSign,
  ExternalLink,
  Globe,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquareQuote,
  RefreshCw,
} from "lucide-react";
import logo from "../../assets/logo-128.webp";
import { supabase } from "../../lib/supabase";
import { EXCLUDE_KEY } from "../../lib/analytics";
import { cn } from "../../lib/utils";
import { ConfirmProvider } from "./ConfirmProvider";
import type { AdminData, AdminTab, PanelProps, Settings, TableName } from "./types";
import { describeError } from "./utils";
import { OverviewPanel } from "./OverviewPanel";
import { SubmissionsPanel } from "./SubmissionsPanel";
import { ProjectsPanel } from "./ProjectsPanel";
import { TestimonialsPanel } from "./TestimonialsPanel";
import { PricingPanel } from "./PricingPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { SiteInfoPanel } from "./SiteInfoPanel";
import { Skeleton } from "./ui";

// Charts are heavy — only load them when the Analytics tab is opened
const AnalyticsPanel = lazy(() => import("./AnalyticsPanel"));

const EMPTY: AdminData = { projects: [], testimonials: [], plans: [], features: [], submissions: [], settings: {} };

async function fetchTable(table: TableName): Promise<Partial<AdminData>> {
  switch (table) {
    case "projects": {
      const { data, error } = await supabase.from("portfolio_projects").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return { projects: data ?? [] };
    }
    case "testimonials": {
      const { data, error } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return { testimonials: data ?? [] };
    }
    case "pricing": {
      const [plans, features] = await Promise.all([
        supabase.from("pricing_plans").select("*").order("sort_order"),
        supabase.from("pricing_features").select("*").order("sort_order"),
      ]);
      if (plans.error) throw plans.error;
      if (features.error) throw features.error;
      return { plans: plans.data ?? [], features: features.data ?? [] };
    }
    case "submissions": {
      const { data, error } = await supabase.from("contact_submissions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return { submissions: data ?? [] };
    }
    case "settings": {
      const { data, error } = await supabase.from("site_settings").select("key, value");
      if (error) throw error;
      const settings: Settings = {};
      (data ?? []).forEach((s: { key: string; value: string }) => (settings[s.key] = s.value));
      return { settings };
    }
  }
}

const ALL_TABLES: TableName[] = ["projects", "testimonials", "pricing", "submissions", "settings"];

type NavItem = { key: AdminTab; label: string; icon: ComponentType<{ className?: string }> };

const NAV: Array<{ group: string | null; items: NavItem[] }> = [
  {
    group: null,
    items: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
      { key: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  { group: "Inbox", items: [{ key: "submissions", label: "Submissions", icon: Inbox }] },
  {
    group: "Content",
    items: [
      { key: "projects", label: "Projects", icon: LayoutGrid },
      { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
      { key: "pricing", label: "Pricing", icon: DollarSign },
    ],
  },
  {
    group: "Settings",
    items: [
      { key: "notifications", label: "Notifications", icon: Bell },
      { key: "site", label: "Site info", icon: Globe },
    ],
  },
];

const PANELS: Record<AdminTab, ComponentType<PanelProps>> = {
  overview: OverviewPanel,
  analytics: AnalyticsPanel,
  submissions: SubmissionsPanel,
  projects: ProjectsPanel,
  testimonials: TestimonialsPanel,
  pricing: PricingPanel,
  notifications: NotificationsPanel,
  site: SiteInfoPanel,
};

export function AdminDashboard({ tab, onTabChange }: { tab: AdminTab; onTabChange: (tab: AdminTab) => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [intent, setIntent] = useState<string | null>(null);
  const knownSubmissionIds = useRef<Set<string> | null>(null);

  const reload = useCallback(async (table: TableName) => {
    try {
      const patch = await fetchTable(table);
      setData((d) => ({ ...d, ...patch }));
    } catch (err) {
      toast.error(`Couldn't load ${table}: ${describeError(err as { message?: string })}`);
    }
  }, []);

  const reloadAll = useCallback(async () => {
    const results = await Promise.allSettled(ALL_TABLES.map(fetchTable));
    const patch: Partial<AdminData> = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled") Object.assign(patch, r.value);
      else toast.error(`Couldn't load ${ALL_TABLES[i]}: ${describeError(r.reason)}`);
    });
    setData((d) => ({ ...d, ...patch }));
  }, []);

  useEffect(() => {
    // Don't count the admin's own browsing in site analytics (toggle lives in the Analytics tab)
    try {
      if (localStorage.getItem(EXCLUDE_KEY) === null) localStorage.setItem(EXCLUDE_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    reloadAll().finally(() => setLoading(false));
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ""));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/admin/Login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [reloadAll, navigate]);

  // Check for new enquiries every minute while the dashboard is open
  useEffect(() => {
    if (loading) return;
    knownSubmissionIds.current ??= new Set(data.submissions.map((s) => s.id));
    const poll = async () => {
      if (document.hidden) return;
      const { data: rows, error } = await supabase.from("contact_submissions").select("*").order("created_at", { ascending: false });
      if (error || !rows) return;
      const known = knownSubmissionIds.current!;
      const fresh = rows.filter((r) => !known.has(r.id));
      rows.forEach((r) => known.add(r.id));
      setData((d) => ({ ...d, submissions: rows }));
      if (fresh.length === 1) toast.info(`New enquiry from ${fresh[0].name}`, { action: { label: "View", onClick: () => goTo("submissions", `open:${fresh[0].id}`) } });
      else if (fresh.length > 1) toast.info(`${fresh.length} new enquiries`, { action: { label: "View", onClick: () => goTo("submissions") } });
    };
    const timer = window.setInterval(poll, 60_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const unread = data.submissions.filter((s) => s.status === "unread").length;

  useEffect(() => {
    document.title = `${unread ? `(${unread}) ` : ""}Admin · RedSpark Digital`;
  }, [unread]);

  function goTo(next: AdminTab, nextIntent?: string) {
    setIntent(nextIntent ?? null);
    onTabChange(next);
    window.scrollTo({ top: 0 });
  }

  async function refresh() {
    setRefreshing(true);
    await reloadAll();
    setRefreshing(false);
    toast.success("Dashboard refreshed");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/Login" });
  }

  const webhookSet = !!data.settings["discord_webhook_url"];
  const notificationsOn = (data.settings["discord_notifications_enabled"] ?? "true") === "true";

  function meta(key: AdminTab): { count?: number; badge?: number; dot?: string } {
    switch (key) {
      case "submissions":
        return { badge: unread };
      case "projects":
        return { count: data.projects.length };
      case "testimonials":
        return { count: data.testimonials.length };
      case "pricing":
        return { count: data.plans.length };
      case "notifications":
        return { dot: !webhookSet ? "bg-muted-foreground/50" : notificationsOn ? "bg-emerald-400" : "bg-amber-400" };
      default:
        return {};
    }
  }

  const Panel = PANELS[tab];
  const panelProps: PanelProps = { data, loading, reload, setData, goTo, intent, clearIntent: () => setIntent(null) };

  return (
    <ConfirmProvider>
      <Toaster theme="dark" position="top-right" richColors closeButton />
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-[256px_1fr]">
        {/* ── Sidebar (desktop) ── */}
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-border/60 bg-card/30 lg:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-5">
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
            <div className="leading-tight">
              <p className="font-display text-sm font-bold">
                RedSpark<span className="text-primary">Digital</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Admin dashboard</p>
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Dashboard">
            {NAV.map(({ group, items }) => (
              <div key={group ?? "root"}>
                {group && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{group}</p>}
                <ul className="space-y-0.5">
                  {items.map(({ key, label, icon: Icon }) => {
                    const m = meta(key);
                    const active = tab === key;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => goTo(key)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                          <span className="flex-1 text-left">{label}</span>
                          {!!m.badge && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">{m.badge}</span>}
                          {m.count != null && !loading && <span className="text-xs tabular-nums text-muted-foreground/70">{m.count}</span>}
                          {m.dot && !loading && <span className={cn("h-2 w-2 rounded-full", m.dot)} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="space-y-1 border-t border-border/60 p-3">
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" /> View live site
            </a>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
            <p className="flex items-center justify-between gap-2 px-3 pt-1 text-[11px] text-muted-foreground/70">
              <span className="truncate">{email}</span>
              <span className="shrink-0 tabular-nums" title="Site version (see CHANGELOG.md)">
                v{__APP_VERSION__}
              </span>
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          {/* ── Top bar ── */}
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10">
              <div className="flex items-center gap-2.5 lg:hidden">
                <img src={logo} alt="" className="h-7 w-7 object-contain" />
                <span className="font-display text-sm font-bold">Admin</span>
              </div>
              <p className="hidden text-sm text-muted-foreground lg:block">
                {unread > 0 ? (
                  <button type="button" onClick={() => goTo("submissions")} className="font-medium text-foreground hover:text-primary">
                    You have {unread} unread {unread === 1 ? "enquiry" : "enquiries"} →
                  </button>
                ) : (
                  "You're all caught up."
                )}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={refreshing}
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <a href="/" target="_blank" rel="noopener" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground lg:hidden" aria-label="View live site">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button type="button" onClick={signOut} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground lg:hidden" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mobile tabs */}
            <nav className="-mb-px flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] lg:hidden" aria-label="Dashboard">
              {NAV.flatMap((g) => g.items).map(({ key, label, icon: Icon }) => {
                const m = meta(key);
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => goTo(key)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    {!!m.badge && <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-white/25" : "bg-primary text-primary-foreground")}>{m.badge}</span>}
                  </button>
                );
              })}
            </nav>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            <div key={tab} className="animate-fade-in">
              <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
                <Panel {...panelProps} />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
