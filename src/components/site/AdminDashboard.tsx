/**
 * AdminDashboard.tsx — with Submissions tab + Discord Notifications
 *
 * New additions vs previous version:
 * ──────────────────────────────────
 *  • "submissions" Tab — full CRUD view of contact_submissions:
 *      - Table with Name, Email, Service, Date, Status columns
 *      - Expandable message preview
 *      - Mark as read/unread
 *      - Delete individual submissions
 *      - Filter by status (all | unread | read)
 *      - Unread badge on stat card + tab
 *  • "notifications" Tab — Discord webhook notification settings:
 *      - Configure a Discord webhook URL to receive alerts
 *      - Stored in `site_settings` table in Supabase
 *      - Toggle notifications on/off globally
 *      - Test notification button
 *  • Stats bar now shows 5 tiles (projects, testimonials, pricing,
 *    unread submissions, notifications)
 */

import { useEffect, useState, useCallback } from "react";
import {
  Trash2, Plus, Pencil, X, Check, Star,
  LayoutGrid, MessageSquareQuote, ArrowLeft,
  Link, Image, Hash, Tag, AlignLeft, Type,
  Loader2, AlertCircle, Sparkles, DollarSign,
  GripVertical, ToggleLeft, ToggleRight,
  Inbox, Bell, BellOff, Mail, Phone, ChevronDown,
  ChevronUp, Eye, EyeOff, Send, Filter, RefreshCw, Globe, ExternalLink,} from "lucide-react";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  title: string;
  tag: string;
  description: string;
  color: string;
  sort_order: number;
  rating?: number;
  website_link?: string;
  image_url?: string;
};

type Testimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
};

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  highlight: boolean;
  sort_order: number;
  price_usd_cents: number;
  active: boolean;
};

type PricingFeature = {
  id: string;
  plan_id: string;
  feature: string;
  sort_order: number;
};

type Submission = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  service: string;
  message: string;
  status: "unread" | "read";
  created_at: string;
};

type DiscordSettings = {
  webhook_url: string;
  active: boolean;
};

type SiteSetting = {
  key: string;
  value: string;
};

type Tab = "projects" | "testimonials" | "pricing" | "submissions" | "notifications" | "site";
type SubmissionFilter = "all" | "unread" | "read";

type SiteInfo = {
  contact_email: string;
  contact_phone: string;       // display string e.g. "+264 81 873 6612"
  contact_phone_raw: string;   // digits for wa.me link e.g. "264818736612"
  social_twitter: string;
  social_instagram: string;
  social_github: string;
  social_facebook: string;
  social_linkedin: string;
};

// ─── Colour options ───────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  { label: "Orange → Pink",   value: "from-orange-500/20 to-pink-500/20",     dot: "from-orange-400 to-pink-400" },
  { label: "Purple → Blue",   value: "from-purple-500/20 to-blue-500/20",     dot: "from-purple-400 to-blue-400" },
  { label: "Cyan → Emerald",  value: "from-cyan-500/20 to-emerald-500/20",    dot: "from-cyan-400 to-emerald-400" },
  { label: "Rose → Violet",   value: "from-rose-500/20 to-violet-500/20",     dot: "from-rose-400 to-violet-400" },
  { label: "Yellow → Orange", value: "from-yellow-500/20 to-orange-500/20",   dot: "from-yellow-400 to-orange-400" },
  { label: "Teal → Sky",      value: "from-teal-500/20 to-sky-500/20",        dot: "from-teal-400 to-sky-400" },
];

// ─── Blanks ───────────────────────────────────────────────────────────────────

const BLANK_PROJECT: Omit<Project, "id"> = {
  title: "", tag: "", description: "",
  color: COLOR_OPTIONS[0].value,
  sort_order: 0, rating: undefined, website_link: undefined, image_url: undefined,
};

const BLANK_TESTIMONIAL: Omit<Testimonial, "id"> = {
  name: "", role: "", text: "", rating: 5,
};

const BLANK_PLAN: Omit<PricingPlan, "id"> = {
  name: "", description: "", highlight: false, sort_order: 0, price_usd_cents: 0, active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function parseDollarsToCents(raw: string): number {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl border border-border/60 bg-card flex items-center justify-center mb-4 text-muted-foreground/50">{icon}</div>
      <p className="font-medium text-foreground/70">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{subtitle}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) { if (e.target === e.currentTarget) onClose(); }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleBackdrop}>
      <div className="animate-modal-in w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]" style={{ boxShadow: "0 25px 60px hsl(0 0% 0% / 0.5), 0 0 0 1px hsl(var(--border) / 0.5)" }}>
        <div className="adm-modal-header flex-shrink-0">
          <h3 className="adm-modal-title">{title}</h3>
          <button onClick={onClose} className="adm-icon-btn" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="adm-modal-body overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, icon, children, optional, className }: { label: string; icon?: React.ReactNode; children: React.ReactNode; optional?: boolean; className?: string }) {
  return (
    <div className={`adm-field ${className ?? ""}`}>
      <label className="adm-field-label">
        {icon && <span className="adm-label-icon">{icon}</span>}
        <span>{label}</span>
        {optional && <span className="adm-field-optional">optional</span>}
      </label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="adm-modal-footer sticky bottom-0">
      <button className="adm-btn-ghost" onClick={onCancel}>Cancel</button>
      <button className="adm-btn-primary" onClick={onSave} disabled={saving}>
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Check className="w-3.5 h-3.5" /> Save changes</>}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("projects");

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [features, setFeatures] = useState<PricingFeature[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [discordSettings, setDiscordSettings] = useState<DiscordSettings>({ webhook_url: "", active: true });
  const [discordWebhookDraft, setDiscordWebhookDraft] = useState("");
  const [_siteInfo, setSiteInfo] = useState<SiteInfo>({
    contact_email: "", contact_phone: "", contact_phone_raw: "",
    social_twitter: "", social_instagram: "", social_github: "",
    social_facebook: "", social_linkedin: "",
  });
  const [siteInfoDraft, setSiteInfoDraft] = useState<SiteInfo>({
    contact_email: "", contact_phone: "", contact_phone_raw: "",
    social_twitter: "", social_instagram: "", social_github: "",
    social_facebook: "", social_linkedin: "",
  });
  const [savingSiteInfo, setSavingSiteInfo] = useState(false);
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Forms
  const [projectForm, setProjectForm] = useState<Omit<Project, "id"> | (Omit<Project, "id"> & { id: string })>(BLANK_PROJECT);
  const [testimonialForm, setTestimonialForm] = useState<Omit<Testimonial, "id"> | (Omit<Testimonial, "id"> & { id: string })>(BLANK_TESTIMONIAL);
  const [planForm, setPlanForm] = useState<Omit<PricingPlan, "id"> | (Omit<PricingPlan, "id"> & { id: string })>(BLANK_PLAN);
  const [planFeaturesDraft, setPlanFeaturesDraft] = useState<string[]>([]);
  const [priceInputRaw, setPriceInputRaw] = useState("");

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // Submission filters
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>("all");

  // UX state
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function notify(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Type guards ────────────────────────────────────────────────────────────
  function isEditingProject(f: typeof projectForm): f is Omit<Project, "id"> & { id: string } { return "id" in f; }
  function isEditingTestimonial(f: typeof testimonialForm): f is Omit<Testimonial, "id"> & { id: string } { return "id" in f; }
  function isEditingPlan(f: typeof planForm): f is Omit<PricingPlan, "id"> & { id: string } { return "id" in f; }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [
      { data: p },
      { data: t },
      { data: pl },
      { data: pf },
      { data: sub },
      { data: settings },
    ] = await Promise.all([
      supabase.from("portfolio_projects").select("*").order("sort_order"),
      supabase.from("testimonials").select("*").order("created_at", { ascending: false }),
      supabase.from("pricing_plans").select("*").order("sort_order"),
      supabase.from("pricing_features").select("*").order("sort_order"),
      supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("site_settings").select("*"),
    ]);
    if (p) setProjects(p);
    if (t) setTestimonials(t);
    if (pl) setPlans(pl);
    if (pf) setFeatures(pf);
    if (sub) setSubmissions(sub as Submission[]);
    if (settings) {
      const map: Record<string, string> = {};
      (settings as SiteSetting[]).forEach((s) => { map[s.key] = s.value; });
      setSiteSettings(map);
      // Load discord settings
      setDiscordSettings({
        webhook_url: map["discord_webhook_url"] ?? "",
        active: (map["discord_notifications_enabled"] ?? "true") === "true",
      });
      setDiscordWebhookDraft(map["discord_webhook_url"] ?? "");
      // Load site info
      const si: SiteInfo = {
        contact_email:    map["contact_email"]    ?? "",
        contact_phone:    map["contact_phone"]    ?? "",
        contact_phone_raw:map["contact_phone_raw"]?? "",
        social_twitter:   map["social_twitter"]   ?? "",
        social_instagram: map["social_instagram"] ?? "",
        social_github:    map["social_github"]    ?? "",
        social_facebook:  map["social_facebook"]  ?? "",
        social_linkedin:  map["social_linkedin"]  ?? "",
      };
      setSiteInfo(si);
      setSiteInfoDraft(si);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Projects CRUD ──────────────────────────────────────────────────────────
  function openNewProject() { setProjectForm({ ...BLANK_PROJECT, sort_order: projects.length + 1 }); setShowProjectModal(true); }
  function openEditProject(p: Project) { setProjectForm({ ...p, website_link: p.website_link ?? undefined, image_url: p.image_url ?? undefined }); setShowProjectModal(true); }

  async function saveProject() {
    if (!projectForm.title.trim() || !projectForm.tag.trim()) { notify("Title and tag are required.", "err"); return; }
    setSaving(true);
    const payload: Omit<Project, "id"> = { ...projectForm, website_link: (projectForm.website_link ?? "").trim() || undefined, image_url: (projectForm.image_url ?? "").trim() || undefined };
    if (isEditingProject(projectForm)) {
      const { error } = await supabase.from("portfolio_projects").update(payload).eq("id", (projectForm as Project).id);
      error ? notify(error.message, "err") : notify("Project updated.");
    } else {
      const { error } = await supabase.from("portfolio_projects").insert(payload);
      error ? notify(error.message, "err") : notify("Project added.");
    }
    setSaving(false); setShowProjectModal(false); fetchAll();
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
    error ? notify(error.message, "err") : notify("Project deleted.");
    setDeletingId(null); fetchAll();
  }

  // ── Testimonials CRUD ──────────────────────────────────────────────────────
  function openNewTestimonial() { setTestimonialForm({ ...BLANK_TESTIMONIAL }); setShowTestimonialModal(true); }
  function openEditTestimonial(t: Testimonial) { setTestimonialForm({ ...t }); setShowTestimonialModal(true); }

  async function saveTestimonial() {
    if (!testimonialForm.name.trim() || !testimonialForm.text.trim()) { notify("Name and review text are required.", "err"); return; }
    setSaving(true);
    if (isEditingTestimonial(testimonialForm)) {
      const { id, ...rest } = testimonialForm;
      const { error } = await supabase.from("testimonials").update(rest).eq("id", id);
      error ? notify(error.message, "err") : notify("Testimonial updated.");
    } else {
      const { error } = await supabase.from("testimonials").insert(testimonialForm);
      error ? notify(error.message, "err") : notify("Testimonial added.");
    }
    setSaving(false); setShowTestimonialModal(false); fetchAll();
  }

  async function deleteTestimonial(id: string) {
    if (!confirm("Delete this testimonial?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    error ? notify(error.message, "err") : notify("Testimonial deleted.");
    setDeletingId(null); fetchAll();
  }

  // ── Pricing CRUD ───────────────────────────────────────────────────────────
  function openNewPlan() { setPlanForm({ ...BLANK_PLAN, sort_order: plans.length + 1 }); setPlanFeaturesDraft([""]); setPriceInputRaw("$0"); setShowPlanModal(true); }
  function openEditPlan(plan: PricingPlan) {
    setPlanForm({ ...plan });
    const planFeats = features.filter(f => f.plan_id === plan.id).sort((a, b) => a.sort_order - b.sort_order).map(f => f.feature);
    setPlanFeaturesDraft(planFeats.length > 0 ? planFeats : [""]);
    setPriceInputRaw(centsToDisplay(plan.price_usd_cents));
    setShowPlanModal(true);
  }

  async function savePlan() {
    if (!planForm.name.trim()) { notify("Plan name is required.", "err"); return; }
    setSaving(true);
    const cents = parseDollarsToCents(priceInputRaw);
    const payload: Omit<PricingPlan, "id"> = { ...planForm, price_usd_cents: cents };
    const cleanFeatures = planFeaturesDraft.map(f => f.trim()).filter(Boolean);

    if (isEditingPlan(planForm)) {
      const planId = (planForm as PricingPlan).id;
      const { error: planErr } = await supabase.from("pricing_plans").update(payload).eq("id", planId);
      if (planErr) { notify(planErr.message, "err"); setSaving(false); return; }
      await supabase.from("pricing_features").delete().eq("plan_id", planId);
      if (cleanFeatures.length > 0) await supabase.from("pricing_features").insert(cleanFeatures.map((feature, i) => ({ plan_id: planId, feature, sort_order: i + 1 })));
      notify("Plan updated.");
    } else {
      const { data: newPlan, error: planErr } = await supabase.from("pricing_plans").insert(payload).select("id").single();
      if (planErr || !newPlan) { notify(planErr?.message ?? "Insert failed", "err"); setSaving(false); return; }
      if (cleanFeatures.length > 0) await supabase.from("pricing_features").insert(cleanFeatures.map((feature, i) => ({ plan_id: newPlan.id, feature, sort_order: i + 1 })));
      notify("Plan added.");
    }
    setSaving(false); setShowPlanModal(false); fetchAll();
  }

  async function deletePlan(id: string) {
    if (!confirm("Delete this pricing plan? Features will also be removed.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("pricing_plans").delete().eq("id", id);
    error ? notify(error.message, "err") : notify("Plan deleted.");
    setDeletingId(null); fetchAll();
  }

  async function togglePlanActive(plan: PricingPlan) {
    const { error } = await supabase.from("pricing_plans").update({ active: !plan.active }).eq("id", plan.id);
    error ? notify(error.message, "err") : notify(plan.active ? "Plan hidden." : "Plan shown.");
    fetchAll();
  }

  function setFeatureLine(index: number, value: string) { setPlanFeaturesDraft(d => { const n = [...d]; n[index] = value; return n; }); }
  function addFeatureLine() { setPlanFeaturesDraft(d => [...d, ""]); }
  function removeFeatureLine(index: number) { setPlanFeaturesDraft(d => d.filter((_, i) => i !== index)); }

  // ── Submissions ────────────────────────────────────────────────────────────
  async function markSubmission(id: string, status: "read" | "unread") {
    const { error } = await supabase.from("contact_submissions").update({ status }).eq("id", id);
    if (error) { notify(error.message, "err"); return; }
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  async function deleteSubmission(id: string) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
    error ? notify(error.message, "err") : notify("Submission deleted.");
    setDeletingId(null);
    setSubmissions(prev => prev.filter(s => s.id !== id));
    if (expandedSubmissionId === id) setExpandedSubmissionId(null);
  }

  async function markAllRead() {
    const unreadIds = submissions.filter(s => s.status === "unread").map(s => s.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase.from("contact_submissions").update({ status: "read" }).in("id", unreadIds);
    if (error) { notify(error.message, "err"); return; }
    setSubmissions(prev => prev.map(s => ({ ...s, status: "read" as const })));
    notify(`${unreadIds.length} submission${unreadIds.length > 1 ? "s" : ""} marked as read.`);
  }

  const filteredSubmissions = submissions.filter(s => {
    if (submissionFilter === "unread") return s.status === "unread";
    if (submissionFilter === "read") return s.status === "read";
    return true;
  });

  const unreadCount = submissions.filter(s => s.status === "unread").length;

  // Assign stable lead numbers chronologically (oldest = #1) across ALL submissions.
  const leadNumberMap = new Map<string, number>(
    [...submissions]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((s, i) => [s.id, i + 1])
  );

  // ── Discord notifications ──────────────────────────────────────────────────

  /** Send a Discord embed directly via the webhook URL — no edge function needed. */
  async function postToDiscord(webhookUrl: string, payload: object): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Discord webhook returned ${res.status}: ${text}`);
    }
  }

  async function sendTestDiscordNotification() {
    const url = discordSettings.webhook_url.trim();
    if (!url) { notify("No webhook URL configured.", "err"); return; }
    setSendingTest(true);
    try {
      await postToDiscord(url, {
        embeds: [{
          title: "🔔 Test Notification",
          description: "Your Discord webhook is correctly configured and working! New contact form submissions will be posted here automatically.",
          color: 0xe05555,
          footer: { text: "Site Admin Dashboard · Test" },
          timestamp: new Date().toISOString(),
        }],
      });
      notify("Test notification sent to Discord ✓");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Test failed.", "err");
    } finally {
      setSendingTest(false);
    }
  }

  async function saveDiscordSettings() {
    const url = discordWebhookDraft.trim();
    if (url && !url.startsWith("https://discord.com/api/webhooks/")) {
      notify("Discord webhook must start with https://discord.com/api/webhooks/", "err"); return;
    }
    const { error: e1 } = await supabase.from("site_settings").upsert({ key: "discord_webhook_url", value: url });
    const { error: e2 } = await supabase.from("site_settings").upsert({ key: "discord_notifications_enabled", value: String(discordSettings.active) });
    if (e1 || e2) { notify("Failed to save Discord settings.", "err"); return; }
    setDiscordSettings(prev => ({ ...prev, webhook_url: url }));
    notify("Discord settings saved.");
  }

  async function saveSiteInfo() {
    setSavingSiteInfo(true);
    const entries: { key: string; value: string }[] = [
      { key: "contact_email",    value: siteInfoDraft.contact_email.trim() },
      { key: "contact_phone",    value: siteInfoDraft.contact_phone.trim() },
      { key: "contact_phone_raw",value: siteInfoDraft.contact_phone_raw.trim().replace(/[^\d]/g, "") },
      { key: "social_twitter",   value: siteInfoDraft.social_twitter.trim() },
      { key: "social_instagram", value: siteInfoDraft.social_instagram.trim() },
      { key: "social_github",    value: siteInfoDraft.social_github.trim() },
      { key: "social_facebook",  value: siteInfoDraft.social_facebook.trim() },
      { key: "social_linkedin",  value: siteInfoDraft.social_linkedin.trim() },
    ];
    const { error } = await supabase.from("site_settings").upsert(entries);
    if (error) { notify("Failed to save site info: " + error.message, "err"); setSavingSiteInfo(false); return; }
    setSiteInfo({ ...siteInfoDraft });
    notify("Site info saved ✓");
    setSavingSiteInfo(false);
  }

  async function toggleGlobalNotifications() {
    const next = !discordSettings.active;
    const { error } = await supabase.from("site_settings").upsert({ key: "discord_notifications_enabled", value: String(next) });
    if (error) { notify(error.message, "err"); return; }
    setDiscordSettings(prev => ({ ...prev, active: next }));
    notify(next ? "Discord notifications enabled." : "Discord notifications paused globally.");
  }

  const notificationsGloballyEnabled = discordSettings.active;

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabConfig: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count: number; badge?: number }> = [
    { key: "projects",      label: "Projects",      icon: LayoutGrid,         count: projects.length },
    { key: "testimonials",  label: "Testimonials",  icon: MessageSquareQuote, count: testimonials.length },
    { key: "pricing",       label: "Pricing",       icon: DollarSign,         count: plans.length },
    { key: "submissions",   label: "Submissions",   icon: Inbox,              count: submissions.length, badge: unreadCount },
    { key: "notifications", label: "Notifications", icon: Bell,               count: discordSettings.webhook_url ? (discordSettings.active ? 1 : 0) : 0 },
    { key: "site",          label: "Site Info",     icon: Globe,              count: 0 },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');

        .adm-input { width:100%; background:#1a1a1a; border:1.5px solid #3a3a3a; border-radius:.5rem; padding:.7rem .875rem; font-size:.9375rem; line-height:1.5; color:#f0f0f0; outline:none; transition:border-color .15s,box-shadow .15s; font-family:'DM Sans',sans-serif; }
        .adm-modal-body .adm-input { background:#2a1e1e; border:1.5px solid #5a3a3a; color:#f5f0f0; }
        .adm-input::placeholder { color:rgba(255,255,255,0.3); }
        .adm-input:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.22); background:#2e2020; }
        .adm-modal-body .adm-input:focus { background:#321f1f; border-color:hsl(var(--primary)); }
        .adm-input:hover:not(:focus) { border-color:#6a4a4a; }
        select.adm-input option { background:#1a1212; color:#f0f0f0; }

        .adm-field { display:flex; flex-direction:column; gap:.5rem; }
        .adm-field-label { display:flex; align-items:center; gap:.4rem; font-size:.8125rem; font-weight:700; color:#e8e0e0; letter-spacing:.02em; text-transform:uppercase; }
        .adm-field-label .adm-label-icon { color:#e05555; flex-shrink:0; }
        .adm-field-optional { margin-left:auto; font-size:.6875rem; font-weight:600; text-transform:uppercase; letter-spacing:.07em; color:#999; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); padding:.15rem .5rem; border-radius:.3rem; }

        .adm-btn-primary { display:inline-flex; align-items:center; gap:.4rem; background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); padding:.55rem 1.1rem; border-radius:.5rem; font-size:.875rem; font-weight:600; letter-spacing:.01em; transition:opacity .15s,transform .1s,box-shadow .15s; cursor:pointer; border:none; box-shadow:0 1px 3px hsl(var(--primary)/.3); }
        .adm-btn-primary:hover { opacity:.88; transform:translateY(-1px); box-shadow:0 4px 12px hsl(var(--primary)/.35); }
        .adm-btn-primary:active { transform:translateY(0); box-shadow:none; }
        .adm-btn-primary:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }

        .adm-btn-ghost { display:inline-flex; align-items:center; gap:.4rem; background:transparent; border:1.5px solid rgba(255,255,255,.18); color:rgba(255,255,255,.7); padding:.55rem 1rem; border-radius:.5rem; font-size:.875rem; font-weight:500; transition:all .15s; cursor:pointer; }
        .adm-btn-ghost:hover { color:#fff; border-color:rgba(255,255,255,.35); background:rgba(255,255,255,.06); }

        .adm-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:2.25rem; height:2.25rem; border-radius:.5rem; border:1px solid transparent; cursor:pointer; transition:all .15s; background:transparent; color:rgba(255,255,255,.45); }
        .adm-icon-btn:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.15); color:#fff; }
        .adm-icon-btn.danger:hover { background:rgba(220,50,50,.15); border-color:rgba(220,50,50,.35); color:#f87171; }
        .adm-icon-btn.success:hover { background:rgba(34,197,94,.15); border-color:rgba(34,197,94,.35); color:#4ade80; }
        .adm-icon-btn:disabled { opacity:.4; cursor:not-allowed; }

        .adm-card { background:hsl(var(--card)); border:1.5px solid rgba(255,255,255,.08); border-radius:.875rem; transition:border-color .15s,box-shadow .15s; }
        .adm-card:hover { border-color:rgba(255,255,255,.15); box-shadow:0 2px 12px rgba(0,0,0,.3); }

        .adm-row-list { border:1.5px solid rgba(255,255,255,.1); border-radius:.875rem; background:hsl(var(--card)); overflow:hidden; }
        .adm-row { display:flex; align-items:center; gap:1rem; padding:.9rem 1.25rem; border-bottom:1px solid rgba(255,255,255,.07); transition:background .12s; }
        .adm-row:last-child { border-bottom:none; }
        .adm-row-list .adm-row:not(.adm-thead):nth-child(even) { background:rgba(255,255,255,.025); }
        .adm-row:hover { background:rgba(255,255,255,.055) !important; }
        .adm-thead { background:rgba(255,255,255,.05) !important; border-bottom:1.5px solid rgba(255,255,255,.12) !important; padding-top:.6rem !important; padding-bottom:.6rem !important; }

        .adm-section-label { font-size:.7rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,.45); }

        .adm-stat-active { border-color:hsl(var(--primary)/.6) !important; background:hsl(var(--primary)/.1) !important; box-shadow:0 0 0 3px hsl(var(--primary)/.12),0 2px 10px hsl(var(--primary)/.2); }

        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .animate-slide-down { animation:slideDown .22s cubic-bezier(.16,1,.3,1); }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .animate-fade-in { animation:fadeIn .18s ease; }
        @keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .animate-modal-in { animation:modalIn .25s cubic-bezier(.16,1,.3,1); }

        .color-swatch { width:1.5rem; height:1.5rem; border-radius:50%; border:2.5px solid transparent; cursor:pointer; transition:transform .12s,border-color .12s,box-shadow .12s; flex-shrink:0; }
        .color-swatch:hover { transform:scale(1.25); }
        .color-swatch.selected { border-color:hsl(var(--foreground)); transform:scale(1.2); box-shadow:0 0 0 2px hsl(var(--background)); }

        .star-btn { background:none; border:none; cursor:pointer; padding:.3rem; border-radius:.375rem; transition:transform .1s; line-height:0; }
        .star-btn:hover { transform:scale(1.25); }

        .feature-row { display:flex; gap:.5rem; align-items:center; }
        .feature-row input { flex:1; }

        .adm-modal-header { display:flex; align-items:center; justify-content:space-between; padding:1.125rem 1.5rem; border-bottom:1.5px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); }
        .adm-modal-title { font-size:1.0625rem; font-weight:700; color:#fff; letter-spacing:-.01em; }
        .adm-modal-body { padding:1.375rem 1.5rem; display:flex; flex-direction:column; gap:1.25rem; }
        .adm-modal-footer { display:flex; justify-content:flex-end; gap:.625rem; padding:1rem 1.5rem; border-top:1.5px solid rgba(255,255,255,.1); background:rgba(0,0,0,.2); }

        .adm-row-actions { display:flex; align-items:center; gap:.25rem; flex-shrink:0; opacity:.4; transition:opacity .15s; }
        .adm-row:hover .adm-row-actions { opacity:1; }

        /* Submission status badge */
        .sub-badge-unread { background:rgba(239,68,68,.15); color:#f87171; border:1px solid rgba(239,68,68,.3); padding:.15rem .55rem; border-radius:9999px; font-size:.65rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
        .sub-badge-read { background:rgba(255,255,255,.06); color:rgba(255,255,255,.4); border:1px solid rgba(255,255,255,.1); padding:.15rem .55rem; border-radius:9999px; font-size:.65rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }

        /* Notification number pill */
        .notif-badge { background:hsl(var(--primary)/.2); color:hsl(var(--primary)); border:1px solid hsl(var(--primary)/.35); padding:.1rem .45rem; border-radius:9999px; font-size:.65rem; font-weight:800; letter-spacing:.04em; }

        /* Filter pills */
        .filter-pill { padding:.35rem .85rem; border-radius:9999px; font-size:.75rem; font-weight:600; border:1.5px solid rgba(255,255,255,.12); color:rgba(255,255,255,.55); cursor:pointer; transition:all .15s; background:transparent; }
        .filter-pill:hover { color:#fff; border-color:rgba(255,255,255,.3); background:rgba(255,255,255,.06); }
        .filter-pill.active { background:hsl(var(--primary)/.2); border-color:hsl(var(--primary)/.5); color:hsl(var(--primary)); }

        /* WhatsApp green accent */
        .wa-green { color:#4ade80; }
        .wa-green-bg { background:rgba(74,222,128,.12); }

        /* Improved submission row unread state */
        .sub-row-unread { border-left:2.5px solid rgba(239,68,68,0.7) !important; background:rgba(239,68,68,0.04) !important; }
        .sub-row-unread:hover { background:rgba(239,68,68,0.07) !important; }

        /* Submissions section title counter */
        .lead-total-badge { display:inline-flex; align-items:center; gap:.3rem; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); padding:.15rem .5rem; border-radius:9999px; font-size:.65rem; font-weight:700; color:rgba(255,255,255,.55); letter-spacing:.04em; }

        /* Drawer slide-in */
        @keyframes drawerIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        .animate-drawer-in { animation:drawerIn .28s cubic-bezier(.16,1,.3,1); }
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[60] flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold shadow-2xl border animate-slide-down backdrop-blur-md ${toast.type === "ok" ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300" : "bg-red-500/15 border-red-500/35 text-red-300"}`}>
          {toast.type === "ok" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between" style={{ height: "3.75rem" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight">Site Dashboard</span>
              <span className="hidden sm:inline text-muted-foreground text-xs ml-2.5">Manage content</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => setTab("submissions")}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 transition-colors"
              >
                <Inbox className="w-3.5 h-3.5" />
                {unreadCount} new
              </button>
            )}
            <a href="/" className="adm-btn-ghost text-xs py-1.5 px-3">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to site
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {tabConfig.map(({ key, label, icon: Icon, count, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`adm-card p-3 sm:p-4 text-left transition-all relative ${tab === key ? "adm-stat-active" : ""}`}
            >
              {badge != null && badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center z-10">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              <div className="flex items-start gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tab === key ? "bg-primary/20" : "bg-muted"}`}>
                  <Icon className={`w-4 h-4 ${tab === key ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  {loading
                    ? <div className="w-6 h-5 rounded bg-muted-foreground/15 animate-pulse mb-1" />
                    : <span className={`text-xl font-bold tracking-tight block leading-none mb-0.5 ${tab === key ? "text-foreground" : "text-foreground/80"}`}>{count}</span>
                  }
                  <span className={`text-[10px] sm:text-xs leading-tight block ${tab === key ? "text-primary font-semibold" : "text-muted-foreground font-medium"}`}>{label}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Tab nav ── */}
        <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl w-fit mb-7" style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)" }}>
          {tabConfig.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? "bg-primary text-primary-foreground shadow-md" : "text-white/50 hover:text-white"}`}
              style={tab !== key ? { "--hover-bg": "rgba(255,255,255,0.08)" } as React.CSSProperties : {}}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {badge != null && badge > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none ${tab === key ? "bg-white/20 text-white" : "bg-red-500/80 text-white"}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════ Projects Tab ══════════════ */}
        {tab === "projects" && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg tracking-tight">Portfolio Projects</h2>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{projects.length} {projects.length === 1 ? "item" : "items"}</p>
              </div>
              <button className="adm-btn-primary" onClick={openNewProject}><Plus className="w-3.5 h-3.5" />Add Project</button>
            </div>
            {loading ? (
              <div className="adm-row-list">{[1,2,3].map(i => (<div key={i} className="adm-row animate-pulse"><div className="w-8 h-8 rounded-lg bg-muted-foreground/10 shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3.5 w-40 rounded bg-muted-foreground/10" /><div className="h-3 w-24 rounded bg-muted-foreground/10" /></div></div>))}</div>
            ) : projects.length === 0 ? (
              <EmptyState icon={<LayoutGrid className="w-6 h-6" />} title="No projects yet" subtitle="Add your first portfolio project to get started." action={<button className="adm-btn-primary" onClick={openNewProject}><Plus className="w-3.5 h-3.5" />Add your first project</button>} />
            ) : (
              <div className="adm-row-list">
                <div className="adm-row adm-thead">
                  <div className="w-8 shrink-0" />
                  <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                    <span className="adm-section-label">Title</span>
                    <span className="adm-section-label w-20 text-center hidden sm:block">Tag</span>
                    <span className="adm-section-label w-12 text-center hidden sm:block">Order</span>
                    <span className="adm-section-label w-20 text-center hidden sm:block">Rating</span>
                    <span className="adm-section-label w-16 text-center hidden sm:block">Links</span>
                  </div>
                  <div className="w-16 shrink-0" />
                </div>
                {projects.map((p) => {
                  const colorOpt = COLOR_OPTIONS.find(c => c.value === p.color) ?? COLOR_OPTIONS[0];
                  return (
                    <div key={p.id} className="adm-row">
                      <div className={`w-9 h-9 rounded-lg bg-linear-to-br ${colorOpt.dot} shrink-0`} />
                      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                        <div className="min-w-0">
                          <span className="font-semibold text-sm truncate block" style={{ color: "#f0eded" }}>{p.title}</span>
                          <span className="text-xs truncate block mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{p.description}</span>
                        </div>
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 w-20 justify-center" style={{ background: "rgba(220,60,60,0.18)", color: "#f87070" }}>{p.tag}</span>
                        <span className="hidden sm:block adm-section-label w-12 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>{p.sort_order}</span>
                        <div className="hidden sm:flex gap-0.5 w-20 justify-center" style={{ color: "#f59e0b" }}>
                          {p.rating != null && p.rating > 0
                            ? Array.from({ length: 5 }).map((_, i) => (<Star key={i} className={`w-3 h-3 ${i < p.rating! ? "fill-current" : "fill-none opacity-20"}`} />))
                            : <span className="adm-section-label">—</span>}
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 w-16 justify-center">
                          {p.website_link && <span title="Has website link" style={{ color: "rgba(220,80,80,0.7)" }}><Link className="w-3.5 h-3.5" /></span>}
                          {p.image_url && <span title="Has image" style={{ color: "rgba(220,80,80,0.7)" }}><Image className="w-3.5 h-3.5" /></span>}
                        </div>
                      </div>
                      <div className="adm-row-actions">
                        <button className="adm-icon-btn" onClick={() => openEditProject(p)} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="adm-icon-btn danger" onClick={() => deleteProject(p.id)} disabled={deletingId === p.id} title="Delete">
                          {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══════════════ Testimonials Tab ══════════════ */}
        {tab === "testimonials" && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg tracking-tight">Testimonials</h2>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{testimonials.length} {testimonials.length === 1 ? "review" : "reviews"}</p>
              </div>
              <button className="adm-btn-primary" onClick={openNewTestimonial}><Plus className="w-3.5 h-3.5" />Add Testimonial</button>
            </div>
            {loading ? (
              <div className="adm-row-list">{[1,2,3].map(i => (<div key={i} className="adm-row animate-pulse"><div className="w-8 h-8 rounded-full bg-muted-foreground/10 shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3.5 w-32 rounded bg-muted-foreground/10" /><div className="h-3 w-full rounded bg-muted-foreground/10" /></div></div>))}</div>
            ) : testimonials.length === 0 ? (
              <EmptyState icon={<MessageSquareQuote className="w-6 h-6" />} title="No testimonials yet" subtitle="Add your first client testimonial to build social proof." action={<button className="adm-btn-primary" onClick={openNewTestimonial}><Plus className="w-3.5 h-3.5" />Add your first review</button>} />
            ) : (
              <div className="adm-row-list">
                <div className="adm-row adm-thead">
                  <div className="w-8 shrink-0" />
                  <div className="flex-1 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                    <span className="adm-section-label">Client</span>
                    <span className="adm-section-label w-20 text-center hidden sm:block">Rating</span>
                    <span className="adm-section-label w-24 hidden sm:block">Role</span>
                  </div>
                  <div className="w-16 shrink-0" />
                </div>
                {testimonials.map((r) => (
                  <div key={r.id} className="adm-row">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: "rgba(200,60,60,0.25)", color: "#f87070" }}>{r.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                      <div className="min-w-0">
                        <span className="font-semibold text-sm block truncate" style={{ color: "#f0eded" }}>{r.name}</span>
                        <p className="text-xs line-clamp-1 leading-relaxed mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>"{r.text}"</p>
                      </div>
                      <div className="hidden sm:flex gap-0.5 w-20 justify-center" style={{ color: "#f59e0b" }}>
                        {Array.from({ length: 5 }).map((_, i) => (<Star key={i} className={`w-3 h-3 ${i < r.rating ? "fill-current" : "fill-none opacity-25"}`} />))}
                      </div>
                      <span className="hidden sm:block text-xs w-24 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{r.role}</span>
                    </div>
                    <div className="adm-row-actions">
                      <button className="adm-icon-btn" onClick={() => openEditTestimonial(r)} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button className="adm-icon-btn danger" onClick={() => deleteTestimonial(r.id)} disabled={deletingId === r.id} title="Delete">
                        {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══════════════ Pricing Tab ══════════════ */}
        {tab === "pricing" && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-lg tracking-tight">Pricing Plans</h2>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{plans.length} plan{plans.length !== 1 ? "s" : ""} · Prices stored in USD, auto-converted for visitors</p>
              </div>
              <button className="adm-btn-primary" onClick={openNewPlan}><Plus className="w-3.5 h-3.5" />Add Plan</button>
            </div>
            {loading ? (
              <div className="adm-row-list">{[1,2,3].map(i => (<div key={i} className="adm-row animate-pulse"><div className="w-8 h-8 rounded-lg bg-muted-foreground/10 shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3.5 w-40 rounded bg-muted-foreground/10" /><div className="h-3 w-24 rounded bg-muted-foreground/10" /></div></div>))}</div>
            ) : plans.length === 0 ? (
              <EmptyState icon={<DollarSign className="w-6 h-6" />} title="No pricing plans yet" subtitle="Add your first plan to display pricing on your site." action={<button className="adm-btn-primary" onClick={openNewPlan}><Plus className="w-3.5 h-3.5" />Add your first plan</button>} />
            ) : (
              <div className="adm-row-list">
                <div className="adm-row adm-thead">
                  <div className="w-8 shrink-0" />
                  <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                    <span className="adm-section-label">Plan</span>
                    <span className="adm-section-label w-20 text-right hidden sm:block">Price (USD)</span>
                    <span className="adm-section-label w-16 text-center hidden sm:block">Features</span>
                    <span className="adm-section-label w-16 text-center hidden sm:block">Popular</span>
                    <span className="adm-section-label w-16 text-center hidden sm:block">Visible</span>
                  </div>
                  <div className="w-16 shrink-0" />
                </div>
                {plans.map((plan) => {
                  const planFeatureCount = features.filter(f => f.plan_id === plan.id).length;
                  return (
                    <div key={plan.id} className={`adm-row ${!plan.active ? "opacity-50" : ""}`}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(200,50,50,0.2)" }}>
                        <DollarSign className="w-4 h-4" style={{ color: "#f87070" }} />
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                        <div className="min-w-0">
                          <span className="font-semibold text-sm truncate block" style={{ color: "#f0eded" }}>{plan.name}</span>
                          <span className="text-xs truncate block mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{plan.description}</span>
                        </div>
                        <span className="hidden sm:block font-mono text-sm font-bold text-right w-20" style={{ color: "#f0eded" }}>{centsToDisplay(plan.price_usd_cents)}</span>
                        <span className="hidden sm:block adm-section-label w-16 text-center" style={{ color: "rgba(255,255,255,0.55)" }}>{planFeatureCount} item{planFeatureCount !== 1 ? "s" : ""}</span>
                        <span className="hidden sm:flex items-center justify-center w-16" style={{ color: plan.highlight ? "#f59e0b" : "rgba(255,255,255,0.18)" }}>
                          <Star className={`w-4 h-4 ${plan.highlight ? "fill-current" : "fill-none"}`} />
                        </span>
                        <button className="hidden sm:flex items-center justify-center w-16 cursor-pointer transition-colors" onClick={() => togglePlanActive(plan)} title={plan.active ? "Hide plan" : "Show plan"} style={{ color: plan.active ? "#f87070" : "rgba(255,255,255,0.25)" }}>
                          {plan.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="adm-row-actions">
                        <button className="adm-icon-btn" onClick={() => openEditPlan(plan)} title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="adm-icon-btn danger" onClick={() => deletePlan(plan.id)} disabled={deletingId === plan.id} title="Delete">
                          {deletingId === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══════════════ Submissions Tab ══════════════ */}
        {tab === "submissions" && (
          <section className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
              <div>
                <h2 className="font-bold text-lg tracking-tight">Contact Submissions</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="lead-total-badge"><Hash className="w-2.5 h-2.5" />{submissions.length} lead{submissions.length !== 1 ? "s" : ""}</span>
                  {unreadCount > 0 && (
                    <span className="lead-total-badge" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#f87171" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse" />{unreadCount} unread
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {unreadCount > 0 && (
                  <button className="adm-btn-ghost text-xs py-1.5 px-3" onClick={markAllRead}>
                    <Eye className="w-3.5 h-3.5" />Mark all read
                  </button>
                )}
                <button className="adm-btn-ghost text-xs py-1.5 px-3" onClick={fetchAll}>
                  <RefreshCw className="w-3.5 h-3.5" />Refresh
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 mb-5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {(["all", "unread", "read"] as SubmissionFilter[]).map((f) => (
                <button key={f} className={`filter-pill ${submissionFilter === f ? "active" : ""}`} onClick={() => setSubmissionFilter(f)}>
                  {f === "all" ? `All (${submissions.length})` : f === "unread" ? `Unread (${submissions.filter(s => s.status === "unread").length})` : `Read (${submissions.filter(s => s.status === "read").length})`}
                </button>
              ))}
            </div>

            {/* List */}
            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-10 h-10 rounded-full bg-muted-foreground/10 shrink-0" />
                  <div className="flex-1 space-y-2"><div className="h-3.5 w-36 rounded bg-muted-foreground/10" /><div className="h-3 w-52 rounded bg-muted-foreground/10" /></div>
                  <div className="h-5 w-14 rounded-full bg-muted-foreground/10" />
                </div>
              ))}</div>
            ) : filteredSubmissions.length === 0 ? (
              <EmptyState icon={<Inbox className="w-6 h-6" />} title={submissionFilter === "all" ? "No submissions yet" : `No ${submissionFilter} submissions`} subtitle={submissionFilter === "all" ? "Contact form submissions will appear here." : "Switch to 'All' to see other submissions."} />
            ) : (
              <div className="space-y-1.5">
                {filteredSubmissions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setExpandedSubmissionId(s.id);
                      if (s.status === "unread") markSubmission(s.id, "read");
                    }}
                    className={`w-full text-left flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all cursor-pointer group ${s.status === "unread" ? "sub-row-unread" : ""}`}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.08)" }}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${s.status === "unread" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/60"}`}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${s.status === "unread" ? "text-white" : "text-white/80"}`}>{s.name}</span>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.28)" }}>#{leadNumberMap.get(s.id)}</span>
                        {s.status === "unread" && <span className="sub-badge-unread">new</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{s.email}</span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.service}</span>
                      </div>
                    </div>

                    {/* Date + chevron */}
                    <div className="shrink-0 text-right hidden sm:block">
                      <span className="text-[11px] tabular-nums block" style={{ color: "rgba(255,255,255,0.35)" }}>{formatDate(s.created_at)}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {/* ── Submission Detail Drawer ── */}
            {expandedSubmissionId && (() => {
              const s = submissions.find(x => x.id === expandedSubmissionId);
              if (!s) return null;
              return (
                <SubmissionDrawer
                  submission={s}
                  leadNumber={leadNumberMap.get(s.id) ?? 0}
                  deletingId={deletingId}
                  onClose={() => setExpandedSubmissionId(null)}
                  onMark={(status) => markSubmission(s.id, status)}
                  onDelete={() => deleteSubmission(s.id)}
                />
              );
            })()}
          </section>
        )}

        {/* ══════════════ Notifications Tab ══════════════ */}
        {tab === "notifications" && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
              <div>
                <h2 className="font-bold text-lg tracking-tight">Discord Notifications</h2>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Receive an instant Discord message whenever a client submits the contact form.
                </p>
              </div>
            </div>

            {/* Global toggle */}
            <div className="rounded-xl border mb-6 p-5 flex items-center justify-between gap-4" style={{ borderColor: notificationsGloballyEnabled ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.1)", background: notificationsGloballyEnabled ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${notificationsGloballyEnabled ? "bg-indigo-500/15" : "bg-muted"}`}>
                  {notificationsGloballyEnabled ? <Bell className="w-5 h-5 text-indigo-400" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{notificationsGloballyEnabled ? "Notifications Active" : "Notifications Paused"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {notificationsGloballyEnabled
                      ? "Discord channel will be notified on new submissions."
                      : "No Discord messages will be sent."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleGlobalNotifications}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold border transition-all ${notificationsGloballyEnabled ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border"}`}
              >
                {notificationsGloballyEnabled
                  ? <><ToggleRight className="w-4 h-4" />Pause</>
                  : <><ToggleLeft className="w-4 h-4" />Enable</>}
              </button>
            </div>

            {/* ── Discord Webhook Section ── */}
            <div className="rounded-xl border border-border/40 bg-card/30 p-5 mb-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${discordSettings.active && discordSettings.webhook_url ? "bg-indigo-500/15" : "bg-muted"}`}>
                    <svg className={`w-5 h-5 ${discordSettings.active && discordSettings.webhook_url ? "text-indigo-400" : "text-muted-foreground"}`} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Webhook URL</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                      Post form submissions to a Discord channel via webhook.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1 adm-field">
                  <label className="adm-field-label">
                    <Link className="w-3 h-3 adm-label-icon" />
                    <span>Webhook URL</span>
                  </label>
                  <input
                    className="adm-input font-mono text-xs"
                    value={discordWebhookDraft}
                    onChange={(e) => setDiscordWebhookDraft(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>
                <button
                  type="button"
                  className="adm-btn-primary shrink-0 py-[0.7rem]"
                  onClick={saveDiscordSettings}
                >
                  <Check className="w-3.5 h-3.5" />Save
                </button>
              </div>
              {discordSettings.webhook_url && (
                <p className="text-[11px] mt-2" style={{ color: "rgba(99,102,241,0.8)" }}>✓ Webhook configured — Discord alerts are {discordSettings.active ? "active" : "paused"}.</p>
              )}
            </div>

            {/* How it works + test button */}
            <div className="rounded-xl border border-border/40 bg-card/30 p-4 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-white/80 mb-1.5">How it works</p>
                  <p className="leading-relaxed max-w-lg">
                    When a client submits the contact form, a rich embed is posted directly to your Discord channel via the webhook URL above — no edge functions or third-party services involved. Just paste your webhook URL and click Save.
                  </p>
                </div>
                {discordSettings.webhook_url && (
                  <button
                    type="button"
                    className="adm-btn-ghost shrink-0 text-xs py-2 px-3"
                    onClick={sendTestDiscordNotification}
                    disabled={sendingTest}
                  >
                    {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send test
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ══════════════ Site Info Tab ══════════════ */}
        {tab === "site" && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
              <div>
                <h2 className="font-bold text-lg tracking-tight">Site Info</h2>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Manage contact details and social links displayed across the site.
                </p>
              </div>
              <button
                className="adm-btn-primary"
                onClick={saveSiteInfo}
                disabled={savingSiteInfo}
              >
                {savingSiteInfo ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Check className="w-3.5 h-3.5" />Save all changes</>}
              </button>
            </div>

            {/* ── Contact Details ── */}
            <div className="rounded-xl border border-border/40 bg-card/30 p-5 mb-5">
              <p className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />Contact Details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email Address" icon={<Mail className="w-3 h-3" />}>
                  <input
                    className="adm-input"
                    type="email"
                    value={siteInfoDraft.contact_email}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, contact_email: e.target.value }))}
                    placeholder="redsparkdigital@gmail.com"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Shown in Footer and Contact section mailto links.</p>
                </Field>
                <Field label="Display Phone Number" icon={<Phone className="w-3 h-3" />}>
                  <input
                    className="adm-input"
                    value={siteInfoDraft.contact_phone}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, contact_phone: e.target.value }))}
                    placeholder="+264 81 873 6612"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Formatted number shown to visitors (e.g. +264 81 873 6612).</p>
                </Field>
                <Field label="WhatsApp / Raw Phone (digits only)" icon={<Phone className="w-3 h-3" />}>
                  <input
                    className="adm-input font-mono"
                    value={siteInfoDraft.contact_phone_raw}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, contact_phone_raw: e.target.value.replace(/[^\d]/g, "") }))}
                    placeholder="264818736612"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Digits only — used for wa.me and tel: links. No + or spaces.</p>
                </Field>
              </div>
            </div>

            {/* ── Social Links ── */}
            <div className="rounded-xl border border-border/40 bg-card/30 p-5">
              <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                <Link className="w-4 h-4 text-primary" />Social Links
              </p>
              <p className="text-xs text-muted-foreground/60 mb-4">Leave a field blank to hide that icon in the Footer.</p>
              <div className="grid gap-4 sm:grid-cols-2">

                {/* X / Twitter */}
                <Field label="X (Twitter)" icon={
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631ZM17.08 20.25h1.832L7.084 4.126H5.117Z"/></svg>
                }>
                  <input
                    className="adm-input"
                    value={siteInfoDraft.social_twitter}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, social_twitter: e.target.value }))}
                    placeholder="https://x.com/yourusername"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Full URL. Leave blank to hide the X icon.</p>
                </Field>

                {/* Instagram */}
                <Field label="Instagram" icon={
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                }>
                  <input
                    className="adm-input"
                    value={siteInfoDraft.social_instagram}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, social_instagram: e.target.value }))}
                    placeholder="https://instagram.com/yourusername"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Full URL. Leave blank to hide the Instagram icon.</p>
                </Field>

                {/* GitHub */}
                <Field label="GitHub" icon={
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                }>
                  <input
                    className="adm-input"
                    value={siteInfoDraft.social_github}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, social_github: e.target.value }))}
                    placeholder="https://github.com/yourusername"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Full URL. Leave blank to hide the GitHub icon.</p>
                </Field>

                {/* Facebook */}
                <Field label="Facebook" icon={
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                }>
                  <input
                    className="adm-input"
                    value={siteInfoDraft.social_facebook}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, social_facebook: e.target.value }))}
                    placeholder="https://facebook.com/yourpage"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Full URL. Leave blank to hide the Facebook icon.</p>
                </Field>

                {/* LinkedIn */}
                <Field label="LinkedIn" icon={
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                }>
                  <input
                    className="adm-input"
                    value={siteInfoDraft.social_linkedin}
                    onChange={(e) => setSiteInfoDraft(d => ({ ...d, social_linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/company/yourpage"
                  />
                  <p className="text-[11px] text-muted-foreground/50">Full URL. Leave blank to hide the LinkedIn icon.</p>
                </Field>

              </div>

              {/* Live preview of which icons will show */}
              <div className="mt-5 pt-4 border-t border-border/30">
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">Icon Preview — active icons only</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { url: siteInfoDraft.social_twitter,   label: "X",         icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631ZM17.08 20.25h1.832L7.084 4.126H5.117Z"/></svg> },
                    { url: siteInfoDraft.social_instagram, label: "Instagram",  icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
                    { url: siteInfoDraft.social_github,    label: "GitHub",     icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> },
                    { url: siteInfoDraft.social_facebook,  label: "Facebook",   icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg> },
                    { url: siteInfoDraft.social_linkedin,  label: "LinkedIn",   icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
                  ].filter(s => s.url.trim()).map(s => (
                    <a
                      key={s.label}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.label}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s.icon}
                    </a>
                  ))}
                  {![siteInfoDraft.social_twitter, siteInfoDraft.social_instagram, siteInfoDraft.social_github, siteInfoDraft.social_facebook, siteInfoDraft.social_linkedin].some(v => v.trim()) && (
                    <p className="text-xs text-muted-foreground/40 italic">No social links set — all icons hidden.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Save button (bottom too for convenience) */}
            <div className="flex justify-end mt-5">
              <button
                className="adm-btn-primary"
                onClick={saveSiteInfo}
                disabled={savingSiteInfo}
              >
                {savingSiteInfo ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Check className="w-3.5 h-3.5" />Save all changes</>}
              </button>
            </div>
          </section>
        )}

      </div>{/* end max-w-5xl container */}

      {/* ════════════════════════ Modals ════════════════════════ */}

      {/* Project Modal */}
      {showProjectModal && (
        <Modal title={isEditingProject(projectForm) ? "Edit Project" : "New Project"} onClose={() => setShowProjectModal(false)}>
          <Field label="Title" icon={<Type className="w-3 h-3" />}>
            <input className="adm-input" value={projectForm.title} onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))} placeholder="Café Luna Website" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tag / Category" icon={<Tag className="w-3 h-3" />}>
              <input className="adm-input" value={projectForm.tag} onChange={(e) => setProjectForm((f) => ({ ...f, tag: e.target.value }))} placeholder="Business Website" />
            </Field>
            <Field label="Sort Order" icon={<Hash className="w-3 h-3" />}>
              <input type="number" className="adm-input" value={projectForm.sort_order} onChange={(e) => setProjectForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </Field>
          </div>
          <Field label="Description" icon={<AlignLeft className="w-3 h-3" />}>
            <textarea className="adm-input resize-none h-20" value={projectForm.description} onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description of the project…" />
          </Field>
          <Field label="Rating" icon={<Star className="w-3 h-3" />} optional>
            <div className="flex items-center gap-1.5 pt-0.5">
              {[1,2,3,4,5].map((n) => (<button key={n} className="star-btn" onClick={() => setProjectForm((f) => ({ ...f, rating: projectForm.rating === n ? undefined : n }))}><Star className={`w-6 h-6 transition-colors ${(projectForm.rating ?? 0) >= n ? "text-amber-400 fill-current" : "text-muted-foreground/30 fill-none hover:text-amber-300"}`} /></button>))}
              {projectForm.rating != null ? <span className="ml-2 text-sm text-muted-foreground">{projectForm.rating} / 5 — click same star to clear</span> : <span className="ml-2 text-sm text-muted-foreground/60">No rating</span>}
            </div>
          </Field>
          <Field label="Website Link" icon={<Link className="w-3 h-3" />} optional>
            <input className="adm-input" type="url" value={projectForm.website_link ?? ""} onChange={(e) => setProjectForm((f) => ({ ...f, website_link: e.target.value }))} placeholder="https://example.com" />
          </Field>
          <Field label="Image Preview URL" icon={<Image className="w-3 h-3" />} optional>
            <input className="adm-input" type="url" value={projectForm.image_url ?? ""} onChange={(e) => setProjectForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/preview.jpg" />
            {(projectForm.image_url ?? "").trim() && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border/40 h-24 bg-card">
                <img src={projectForm.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </Field>
          <Field label="Card Colour">
            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              {COLOR_OPTIONS.map((c) => (<button key={c.value} title={c.label} onClick={() => setProjectForm((f) => ({ ...f, color: c.value }))} className={`color-swatch bg-linear-to-br ${c.dot} ${projectForm.color === c.value ? "selected" : ""}`} />))}
              <span className="text-xs text-muted-foreground ml-1">{COLOR_OPTIONS.find(c => c.value === projectForm.color)?.label}</span>
            </div>
          </Field>
          <ModalActions onCancel={() => setShowProjectModal(false)} onSave={saveProject} saving={saving} />
        </Modal>
      )}

      {/* Testimonial Modal */}
      {showTestimonialModal && (
        <Modal title={isEditingTestimonial(testimonialForm) ? "Edit Testimonial" : "New Testimonial"} onClose={() => setShowTestimonialModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Name" icon={<Type className="w-3 h-3" />}>
              <input className="adm-input" value={testimonialForm.name} onChange={(e) => setTestimonialForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sarah K." autoFocus />
            </Field>
            <Field label="Client Title / Role" icon={<Tag className="w-3 h-3" />}>
              <input className="adm-input" value={testimonialForm.role} onChange={(e) => setTestimonialForm((f) => ({ ...f, role: e.target.value }))} placeholder="Small business owner" />
            </Field>
          </div>
          <Field label="Review" icon={<AlignLeft className="w-3 h-3" />}>
            <textarea className="adm-input resize-none h-28" value={testimonialForm.text} onChange={(e) => setTestimonialForm((f) => ({ ...f, text: e.target.value }))} placeholder="What they said about working with you…" />
          </Field>
          <Field label="Rating">
            <div className="flex items-center gap-1.5 pt-0.5">
              {[1,2,3,4,5].map((n) => (<button key={n} className="star-btn" onClick={() => setTestimonialForm((f) => ({ ...f, rating: n }))}><Star className={`w-6 h-6 transition-colors ${n <= testimonialForm.rating ? "text-amber-400 fill-current" : "text-muted-foreground/30 fill-none"}`} /></button>))}
              <span className="ml-2 text-sm text-muted-foreground">{testimonialForm.rating} / 5</span>
            </div>
          </Field>
          <ModalActions onCancel={() => setShowTestimonialModal(false)} onSave={saveTestimonial} saving={saving} />
        </Modal>
      )}

      {/* Pricing Plan Modal */}
      {showPlanModal && (
        <Modal title={isEditingPlan(planForm) ? "Edit Pricing Plan" : "New Pricing Plan"} onClose={() => setShowPlanModal(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plan Name" icon={<Type className="w-3 h-3" />}>
              <input className="adm-input" value={planForm.name} onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))} placeholder="Website Starter" autoFocus />
            </Field>
            <Field label="Starting Price (USD)" icon={<DollarSign className="w-3 h-3" />}>
              <input className="adm-input" value={priceInputRaw} onChange={(e) => setPriceInputRaw(e.target.value)} onBlur={() => { const cents = parseDollarsToCents(priceInputRaw); setPriceInputRaw(centsToDisplay(cents)); setPlanForm((f) => ({ ...f, price_usd_cents: cents })); }} placeholder="$49" />
            </Field>
          </div>
          <Field label="Sub-heading" icon={<AlignLeft className="w-3 h-3" />}>
            <input className="adm-input" value={planForm.description} onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))} placeholder="Perfect for a quick tune-up." />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Sort Order" icon={<GripVertical className="w-3 h-3" />}>
              <input type="number" className="adm-input" value={planForm.sort_order} onChange={(e) => setPlanForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </Field>
            <Field label="Most Popular Badge">
              <button type="button" onClick={() => setPlanForm((f) => ({ ...f, highlight: !f.highlight }))} className={`adm-input flex items-center gap-2 cursor-pointer select-none ${planForm.highlight ? "border-accent/60 text-accent" : ""}`}>
                <Star className={`w-4 h-4 shrink-0 ${planForm.highlight ? "fill-current text-accent" : "fill-none text-muted-foreground/40"}`} />
                <span className="text-sm">{planForm.highlight ? "Yes" : "No"}</span>
              </button>
            </Field>
            <Field label="Visible on Site">
              <button type="button" onClick={() => setPlanForm((f) => ({ ...f, active: !f.active }))} className={`adm-input flex items-center gap-2 cursor-pointer select-none ${planForm.active ? "border-emerald-500/40 text-emerald-400" : ""}`}>
                {planForm.active ? <ToggleRight className="w-4 h-4 text-emerald-400 shrink-0" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                <span className="text-sm">{planForm.active ? "Shown" : "Hidden"}</span>
              </button>
            </Field>
          </div>
          <Field label="Features (bullet points)" icon={<Check className="w-3 h-3" />}>
            <div className="space-y-2">
              {planFeaturesDraft.map((feat, i) => (
                <div key={i} className="feature-row">
                  <input className="adm-input" value={feat} onChange={(e) => setFeatureLine(i, e.target.value)} placeholder={`Feature ${i + 1}…`} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeatureLine(); } }} />
                  <button className="adm-icon-btn danger shrink-0" onClick={() => removeFeatureLine(i)} title="Remove" disabled={planFeaturesDraft.length === 1}><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" className="adm-btn-ghost text-xs py-1.5 px-3 w-full justify-center" onClick={addFeatureLine}><Plus className="w-3 h-3" />Add feature</button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1">Press Enter in a field to add another. Blank lines are ignored.</p>
          </Field>
          <ModalActions onCancel={() => setShowPlanModal(false)} onSave={savePlan} saving={saving} />
        </Modal>
      )}

    </div>
  );
}

// ─── SubmissionDrawer ─────────────────────────────────────────────────────────

function SubmissionDrawer({
  submission: s,
  leadNumber,
  deletingId,
  onClose,
  onMark,
  onDelete,
}: {
  submission: {
    id: string; name: string; email: string; phone?: string;
    service: string; message: string; status: "unread" | "read"; created_at: string;
  };
  leadNumber: number;
  deletingId: string | null;
  onClose: () => void;
  onMark: (status: "read" | "unread") => void;
  onDelete: () => void;
}) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-ZA", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] flex flex-col animate-drawer-in"
        style={{ background: "#0f0f0f", borderLeft: "1.5px solid rgba(255,255,255,0.1)", boxShadow: "-20px 0 60px rgba(0,0,0,0.6)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1.5px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${s.status === "unread" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/60"}`}>
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base">{s.name}</span>
                <span className="font-black tabular-nums text-[10px] px-2 py-0.5 rounded-md" style={{ background: "rgba(220,50,50,0.18)", color: "#f87070", border: "1px solid rgba(220,50,50,0.3)" }}>
                  #{leadNumber}
                </span>
              </div>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{formatDate(s.created_at)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="adm-icon-btn"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Service badge */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
              {s.service}
            </span>
            <span className={s.status === "unread" ? "sub-badge-unread" : "sub-badge-read"}>{s.status}</span>
          </div>

          {/* Contact details */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Contact Details</p>
            <div className="space-y-3">
              <DetailRow label="Email">
                <a href={`mailto:${s.email}`} className="text-sm font-medium hover:underline" style={{ color: "hsl(var(--primary))" }}>{s.email}</a>
              </DetailRow>
              <DetailRow label="Phone">
                {s.phone
                  ? <a href={`tel:${s.phone}`} className="text-sm font-medium hover:underline" style={{ color: "#f0eded" }}>{s.phone}</a>
                  : <span className="text-sm italic" style={{ color: "rgba(255,255,255,0.25)" }}>Not provided</span>
                }
              </DetailRow>
              <DetailRow label="Service">
                <span className="text-sm font-semibold" style={{ color: "#f0eded" }}>{s.service}</span>
              </DetailRow>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

          {/* Message */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Message</p>
            <div className="rounded-xl px-4 py-3.5 text-sm leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.82)", whiteSpace: "pre-wrap" }}>
              {s.message}
            </div>
          </div>
        </div>

        {/* ── Action footer ── */}
        <div className="shrink-0 px-6 py-4 space-y-2.5" style={{ borderTop: "1.5px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)" }}>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`mailto:${s.email}?subject=Re: Your ${encodeURIComponent(s.service)} enquiry`}
              className="adm-btn-ghost text-sm py-2.5 justify-center"
              style={{ textDecoration: "none" }}
            >
              <Mail className="w-4 h-4 shrink-0" />
              Reply by Email
            </a>
            {s.phone ? (
              <a
                href={`https://wa.me/${s.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 wa-green wa-green-bg hover:opacity-80 transition-opacity"
                style={{ textDecoration: "none", border: "1.5px solid rgba(74,222,128,0.3)" }}
              >
                <Phone className="w-4 h-4 shrink-0" />
                WhatsApp
              </a>
            ) : (
              <button disabled className="adm-btn-ghost text-sm py-2.5 justify-center opacity-30 cursor-not-allowed">
                <Phone className="w-4 h-4 shrink-0" />
                No Phone
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="adm-btn-ghost text-sm py-2.5 justify-center"
              onClick={() => onMark(s.status === "unread" ? "read" : "unread")}
            >
              {s.status === "unread" ? <><Eye className="w-4 h-4 shrink-0" />Mark Read</> : <><EyeOff className="w-4 h-4 shrink-0" />Mark Unread</>}
            </button>
            <button
              className="adm-btn-ghost text-sm py-2.5 justify-center"
              style={{ color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
              onClick={onDelete}
              disabled={deletingId === s.id}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {deletingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 shrink-0" />Delete</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider w-14 shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}