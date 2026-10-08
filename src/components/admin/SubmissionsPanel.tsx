import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Inbox,
  Mail,
  Package,
  Phone,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { formatUsd } from "../../lib/currency";
import { isPackageValue, packageName } from "../../lib/site";
import { IconWhatsApp } from "../site/icons";
import { useConfirm } from "./confirm-context";
import type { PanelProps, PricingPlan, Submission } from "./types";
import { Badge, Button, Drawer, EmptyState, IconButton, PageHeader, SearchInput, Segmented, Skeleton } from "./ui";
import { copyText, dayGroup, describeError, downloadCsv, formatDateTime, initials, relativeTime } from "./utils";

type StatusFilter = "all" | "unread" | "read";
type TypeFilter = "all" | "services" | "packages";

/** wa.me needs an international number; local Namibian numbers start with 0. */
function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `264${digits.slice(1)}` : digits;
}

export function SubmissionsPanel({ data, loading, setData, intent, clearIntent }: PanelProps) {
  const confirm = useConfirm();
  const { submissions, plans } = data;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Enquiries opened while filtering by "Unread" stay in the list (instead of vanishing
  // once they're marked read) so next/previous navigation keeps working.
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  useEffect(() => setPinned(new Set()), [status]);

  // Oldest = #1, stable regardless of filters
  const leadNumbers = useMemo(
    () => new Map([...submissions].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((s, i) => [s.id, i + 1])),
    [submissions],
  );

  const counts = useMemo(
    () => ({
      all: submissions.length,
      unread: submissions.filter((s) => s.status === "unread").length,
      read: submissions.filter((s) => s.status === "read").length,
      packages: submissions.filter((s) => isPackageValue(s.service)).length,
    }),
    [submissions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((s) => {
      if (status !== "all" && s.status !== status && !pinned.has(s.id)) return false;
      if (type === "packages" && !isPackageValue(s.service)) return false;
      if (type === "services" && isPackageValue(s.service)) return false;
      if (!q) return true;
      return [s.name, s.email, s.phone ?? "", s.service, s.message].some((v) => v.toLowerCase().includes(q));
    });
  }, [submissions, query, status, type, pinned]);

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: Submission[] }> = [];
    for (const s of filtered) {
      const label = dayGroup(s.created_at);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    }
    return out;
  }, [filtered]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  async function setStatusFor(ids: string[], next: Submission["status"], quiet = false) {
    if (ids.length === 0) return;
    const prev = submissions;
    setData((d) => ({ ...d, submissions: d.submissions.map((s) => (ids.includes(s.id) ? { ...s, status: next } : s)) }));
    const { error } = await supabase.from("contact_submissions").update({ status: next }).in("id", ids);
    if (error) {
      setData((d) => ({ ...d, submissions: prev }));
      toast.error(describeError(error));
    } else if (!quiet) {
      toast.success(`${ids.length} ${ids.length === 1 ? "enquiry" : "enquiries"} marked as ${next}`);
    }
  }

  async function remove(ids: string[]) {
    const ok = await confirm({
      title: ids.length === 1 ? "Delete this enquiry?" : `Delete ${ids.length} enquiries?`,
      description: "This permanently removes the message and contact details. It can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.from("contact_submissions").delete().in("id", ids);
    setBusy(false);
    if (error) return toast.error(describeError(error));
    setData((d) => ({ ...d, submissions: d.submissions.filter((s) => !ids.includes(s.id)) }));
    setSelected((sel) => new Set([...sel].filter((id) => !ids.includes(id))));
    if (openId && ids.includes(openId)) setOpenId(null);
    toast.success(ids.length === 1 ? "Enquiry deleted" : `${ids.length} enquiries deleted`);
  }

  function open(s: Submission) {
    setOpenId(s.id);
    setPinned((p) => (p.has(s.id) ? p : new Set(p).add(s.id)));
    if (s.status === "unread") setStatusFor([s.id], "read", true);
  }

  // Deep link from the overview / new-enquiry toast
  useEffect(() => {
    if (!intent?.startsWith("open:") || loading) return;
    const target = submissions.find((s) => s.id === intent.slice(5));
    if (target) open(target);
    clearIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, loading]);

  function exportCsv() {
    downloadCsv(
      `redspark-enquiries-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((s) => ({
        lead: leadNumbers.get(s.id),
        received: formatDateTime(s.created_at),
        status: s.status,
        name: s.name,
        email: s.email,
        phone: s.phone ?? "",
        service: s.service,
        message: s.message,
      })),
    );
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((s) => s.id)));
  const toggleOne = (id: string) =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openIndex = filtered.findIndex((s) => s.id === openId);
  const current = submissions.find((s) => s.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Submissions"
        description={`${counts.all} enquir${counts.all === 1 ? "y" : "ies"} from the contact form · ${counts.unread} unread`}
        actions={
          <>
            {counts.unread > 0 && (
              <Button size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => setStatusFor(submissions.filter((s) => s.status === "unread").map((s) => s.id), "read")}>
                Mark all read
              </Button>
            )}
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, email, message…" className="xl:max-w-xs xl:flex-1" />
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "unread", label: "Unread", count: counts.unread },
              { value: "read", label: "Read", count: counts.read },
            ]}
          />
          <Segmented
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "Any type" },
              { value: "services", label: "Services" },
              { value: "packages", label: "Packages", count: counts.packages },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={submissions.length === 0 ? "No enquiries yet" : "Nothing matches"}
          description={submissions.length === 0 ? "Contact form submissions will appear here." : "Try a different search or filter."}
          action={
            submissions.length > 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setType("all");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <div className="flex items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-2.5">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 accent-[var(--color-primary)]" aria-label="Select all visible" />
            <span className="text-xs text-muted-foreground">{selected.size > 0 ? `${selected.size} selected` : `${filtered.length} shown`}</span>
          </div>

          {groups.map((g) => (
            <div key={g.label}>
              <p className="border-b border-border/40 bg-background/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {g.label}
              </p>
              <ul className="divide-y divide-border/40">
                {g.items.map((s) => {
                  const pkg = packageName(s.service);
                  const unread = s.status === "unread";
                  return (
                    <li key={s.id} className={cn("group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/30", unread && "bg-primary/[0.04]")}>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        className="mt-3 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                        aria-label={`Select enquiry from ${s.name}`}
                      />
                      <button type="button" onClick={() => open(s)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <span
                          className={cn(
                            "relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            unread ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {initials(s.name)}
                          {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn("text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{s.name}</span>
                            <span className="text-[11px] tabular-nums text-muted-foreground/60">#{leadNumbers.get(s.id)}</span>
                            {pkg ? (
                              <Badge tone="primary">
                                <Package className="h-2.5 w-2.5" /> {pkg}
                              </Badge>
                            ) : (
                              <Badge>{s.service}</Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{s.email}</span>
                          <span className={cn("mt-1 line-clamp-1 text-sm", unread ? "text-foreground/85" : "text-muted-foreground")}>{s.message}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[11px] text-muted-foreground" title={formatDateTime(s.created_at)}>
                            {relativeTime(s.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 animate-pop-in">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-2xl backdrop-blur">
            <span className="px-2 text-sm font-semibold">{selected.size} selected</span>
            <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setStatusFor([...selected], "read")}>
              Mark read
            </Button>
            <Button size="sm" variant="ghost" icon={<EyeOff className="h-3.5 w-3.5" />} onClick={() => setStatusFor([...selected], "unread")}>
              Mark unread
            </Button>
            <Button size="sm" variant="danger" loading={busy} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove([...selected])}>
              Delete
            </Button>
            <IconButton label="Clear selection" size="iconSm" icon={<X className="h-4 w-4" />} onClick={() => setSelected(new Set())} />
          </div>
        </div>
      )}

      {current && (
        <SubmissionDrawer
          submission={current}
          leadNumber={leadNumbers.get(current.id) ?? 0}
          plans={plans}
          hasPrev={openIndex > 0}
          hasNext={openIndex >= 0 && openIndex < filtered.length - 1}
          onPrev={() => openIndex > 0 && open(filtered[openIndex - 1])}
          onNext={() => openIndex < filtered.length - 1 && open(filtered[openIndex + 1])}
          onClose={() => setOpenId(null)}
          onToggleRead={() => setStatusFor([current.id], current.status === "unread" ? "read" : "unread")}
          onDelete={() => remove([current.id])}
        />
      )}
    </>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function SubmissionDrawer({
  submission: s,
  leadNumber,
  plans,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onToggleRead,
  onDelete,
}: {
  submission: Submission;
  leadNumber: number;
  plans: PricingPlan[];
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const titleId = useId();
  const pkg = packageName(s.service);
  const plan = pkg ? plans.find((p) => p.name === pkg) : undefined;
  const firstName = s.name.trim().split(/\s+/)[0];
  const topic = pkg ? `${pkg} package` : s.service;

  // j / k or arrow keys to move between enquiries
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if ((e.key === "ArrowDown" || e.key === "j") && hasNext) onNext();
      if ((e.key === "ArrowUp" || e.key === "k") && hasPrev) onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasNext, hasPrev, onNext, onPrev]);

  const quoted = s.message
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const mailto = `mailto:${s.email}?subject=${encodeURIComponent(`Re: your ${topic} enquiry — RedSpark Digital`)}&body=${encodeURIComponent(
    `Hi ${firstName},\n\nThanks for getting in touch about ${topic}.\n\n\n\nKind regards,\nRedSpark Digital\n\n---\n${quoted}`,
  )}`;
  const wa = s.phone
    ? `https://wa.me/${whatsappNumber(s.phone)}?text=${encodeURIComponent(`Hi ${firstName}, this is RedSpark Digital following up on your ${topic} enquiry.`)}`
    : null;

  return (
    <Drawer onClose={onClose} labelledBy={titleId}>
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
        <div className="flex items-center gap-1">
          <IconButton label="Previous enquiry (k)" size="iconSm" disabled={!hasPrev} onClick={onPrev} icon={<ChevronUp className="h-4 w-4" />} />
          <IconButton label="Next enquiry (j)" size="iconSm" disabled={!hasNext} onClick={onNext} icon={<ChevronDown className="h-4 w-4" />} />
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">Lead #{leadNumber}</span>
        </div>
        <IconButton label="Close" size="iconSm" onClick={onClose} icon={<X className="h-4 w-4" />} />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">{initials(s.name)}</span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold">
              {s.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(s.created_at)} · {relativeTime(s.created_at)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={s.status === "unread" ? "danger" : "neutral"}>{s.status}</Badge>
              {pkg ? (
                <Badge tone="primary">
                  <Package className="h-2.5 w-2.5" /> Package
                </Badge>
              ) : (
                <Badge>{s.service}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <a href={mailto} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-glow">
            <Mail className="h-4 w-4" /> Reply
          </a>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              <IconWhatsApp className="h-4 w-4" /> WhatsApp
            </a>
          ) : (
            <span className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border/60 text-sm text-muted-foreground/60">No phone</span>
          )}
          {s.phone && (
            <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-secondary sm:col-span-1">
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        </div>

        <dl className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50 text-sm">
          <DetailRow label="Email">
            <span className="truncate">{s.email}</span>
            <IconButton label="Copy email" size="iconSm" onClick={() => copyText(s.email, "Email copied")} icon={<Copy className="h-3.5 w-3.5" />} />
          </DetailRow>
          <DetailRow label="Phone">
            {s.phone ? (
              <>
                <span>{s.phone}</span>
                <IconButton label="Copy phone" size="iconSm" onClick={() => copyText(s.phone!, "Phone copied")} icon={<Copy className="h-3.5 w-3.5" />} />
              </>
            ) : (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </DetailRow>
          <DetailRow label={pkg ? "Package" : "Service"}>
            <span className="font-medium">{pkg ?? s.service}</span>
          </DetailRow>
          {pkg && (
            <DetailRow label="Price">
              {plan ? (
                <span>
                  from <strong>{formatUsd(plan.price_usd_cents)}</strong> USD{!plan.active && <span className="text-muted-foreground"> · plan now hidden</span>}
                </span>
              ) : (
                <span className="text-muted-foreground">Plan no longer exists</span>
              )}
            </DetailRow>
          )}
        </dl>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Message</p>
          <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-card/50 px-4 py-3.5 text-sm leading-relaxed text-foreground/90">{s.message}</div>
          <button type="button" onClick={() => copyText(s.message, "Message copied")} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Copy className="h-3 w-3" /> Copy message
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/70 bg-card/40 px-5 py-4">
        <Button onClick={onToggleRead} icon={s.status === "unread" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}>
          Mark {s.status === "unread" ? "read" : "unread"}
        </Button>
        <Button variant="danger" onClick={onDelete} icon={<Trash2 className="h-4 w-4" />}>
          Delete
        </Button>
      </div>
    </Drawer>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3 px-4 py-2">
      <dt className="w-16 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-2">{children}</dd>
    </div>
  );
}
