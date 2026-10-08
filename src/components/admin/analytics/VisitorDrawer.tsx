import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, Globe, Laptop, Loader2, MousePointerClick, Smartphone, Tablet, Trash2, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { IconWhatsApp } from "../../site/icons";
import { useConfirm } from "../confirm-context";
import { Badge, Button, Drawer, IconButton } from "../ui";
import { copyText, formatDateTime, relativeTime } from "../utils";
import {
  ACTION_LABELS,
  SECTION_ORDER,
  countryName,
  fetchVisitor,
  forgetVisitor,
  formatDuration,
  serviceLabel,
  visitorName,
  visitorTag,
  type VisitorDetail,
  type VisitorEvent,
} from "./api";

export function DeviceIcon({ device, className = "h-4 w-4" }: { device: string | null | undefined; className?: string }) {
  if (device === "mobile") return <Smartphone className={className} />;
  if (device === "tablet") return <Tablet className={className} />;
  return <Laptop className={className} />;
}

const sectionName = Object.fromEntries(SECTION_ORDER);

function describeEvent(e: VisitorEvent): { icon: React.ReactNode; text: string; highlight?: boolean } {
  if (e.type === "pageview") return { icon: <Eye className="h-3.5 w-3.5" />, text: `Viewed ${e.path === "/" || !e.path ? "the homepage" : e.path}${e.props?.hash ? ` (${e.props.hash})` : ""}` };
  const p = e.props ?? {};
  switch (e.name) {
    case "contact_submit":
      return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: `Sent an enquiry — ${serviceLabel(p.service) || "contact form"}`, highlight: true };
    case "whatsapp_click":
      return { icon: <IconWhatsApp className="h-3.5 w-3.5" />, text: `Opened WhatsApp${p.where ? ` (from ${p.where})` : ""}`, highlight: true };
    case "phone_click":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: "Tapped the phone number", highlight: true };
    case "email_click":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: "Clicked the email address", highlight: true };
    case "service_request":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: `Chose ${serviceLabel(p.service)}` };
    case "faq_open":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: `Opened FAQ: ${p.question}` };
    case "project_view":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: `Opened project: ${p.project}` };
    case "currency_toggle":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: `Switched prices to ${p.currency}` };
    case "cta_click":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: `Clicked “${p.label || "Get a quote"}”` };
    case "outbound_click":
      return { icon: <Globe className="h-3.5 w-3.5" />, text: `Left for ${p.host}` };
    case "contact_invalid":
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: `Contact form error (${p.fields})` };
    default:
      return { icon: <MousePointerClick className="h-3.5 w-3.5" />, text: ACTION_LABELS[e.name ?? ""] ?? e.name ?? "Event" };
  }
}

type SessionGroup = {
  id: string;
  start: string;
  duration: number;
  scroll: number;
  first: VisitorEvent;
  sections: string[];
  events: VisitorEvent[];
};

function groupSessions(events: VisitorEvent[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>();
  // events arrive newest first; walk oldest → newest inside each session
  for (const e of [...events].reverse()) {
    let g = map.get(e.session_id);
    if (!g) {
      g = { id: e.session_id, start: e.t, duration: 0, scroll: 0, first: e, sections: [], events: [] };
      map.set(e.session_id, g);
    }
    if (e.type === "engagement") {
      g.duration = Math.max(g.duration, e.duration_s ?? 0);
      g.scroll = Math.max(g.scroll, e.scroll_pct ?? 0);
    } else if (e.name === "section_view") {
      if (e.props?.section && !g.sections.includes(e.props.section)) g.sections.push(e.props.section);
    } else {
      g.events.push(e);
    }
  }
  return [...map.values()].sort((a, b) => b.start.localeCompare(a.start));
}

export function VisitorDrawer({ visitorId, onClose, onForgotten }: { visitorId: string; onClose: () => void; onForgotten: () => void }) {
  const titleId = useId();
  const confirm = useConfirm();
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    fetchVisitor(visitorId)
      .then((d) => alive && setDetail(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [visitorId]);

  const sessions = useMemo(() => (detail ? groupSessions(detail.events) : []), [detail]);
  const latest = detail?.events[0];
  const totalTime = sessions.reduce((a, s) => a + s.duration, 0);
  const contacted = detail?.events.some((e) => e.name === "contact_submit");

  async function forget() {
    const ok = await confirm({
      title: `Forget ${visitorName(visitorId)}?`,
      description: "Deletes every recorded visit and event for this visitor, including IP addresses. Use this for privacy requests. It can't be undone.",
      confirmLabel: "Delete visitor data",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await forgetVisitor(visitorId);
      toast.success("Visitor data deleted");
      onForgotten();
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Drawer onClose={onClose} labelledBy={titleId}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
            <DeviceIcon device={latest?.device} className="h-5 w-5" />
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-bold">
              {visitorName(visitorId)} <span className="text-sm font-medium text-muted-foreground">· {visitorTag(visitorId)}</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {detail?.first_seen ? <>First seen {formatDateTime(detail.first_seen)}</> : "Loading…"}
            </p>
          </div>
        </div>
        <IconButton label="Close" size="iconSm" onClick={onClose} icon={<X className="h-4 w-4" />} />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {!detail && !error && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading visitor…
          </div>
        )}

        {detail && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Visits", detail.sessions.toLocaleString()],
                ["Page views", detail.pageviews.toLocaleString()],
                ["Time on site", formatDuration(totalTime)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/60 bg-card/50 px-2 py-3">
                  <p className="text-lg font-semibold">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>

            <dl className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/50 text-sm">
              <Row label="Location">
                {latest?.city ? `${latest.city}${latest.region && latest.region !== latest.city ? `, ${latest.region}` : ""} · ` : ""}
                {countryName(latest?.country)}
              </Row>
              <Row label="Device">
                <span className="capitalize">{latest?.device ?? "—"}</span> · {latest?.browser ?? "—"} on {latest?.os ?? "—"}
                {latest?.screen && <span className="text-muted-foreground"> · {latest.screen}</span>}
              </Row>
              <Row label="Language">{latest?.language ?? "—"}</Row>
              <Row label={detail.ips.length > 1 ? "IP addresses" : "IP address"}>
                {detail.ips.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {detail.ips.map((ip) => (
                      <button key={ip} type="button" onClick={() => copyText(ip, "IP copied")} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs hover:bg-secondary/70" title="Copy">
                        {ip}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not stored (older than 90 days)</span>
                )}
              </Row>
              <Row label="Last seen">{detail.last_seen ? relativeTime(detail.last_seen) : "—"}</Row>
              <Row label="Status">{contacted ? <Badge tone="success">Sent an enquiry</Badge> : <Badge>No enquiry yet</Badge>}</Row>
            </dl>

            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Visit history</p>
              <ol className="space-y-4">
                {sessions.map((s) => (
                  <li key={s.id} className="rounded-xl border border-border/60 bg-card/40">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
                      <span className="text-sm font-semibold">{formatDateTime(s.start)}</span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDuration(s.duration)}</span>
                        {s.scroll > 0 && <span>scrolled {s.scroll}%</span>}
                        <span>via {s.first.source ?? "Direct"}</span>
                        {s.first.campaign && <span>· {s.first.campaign}</span>}
                      </span>
                    </div>
                    <ul className="space-y-2 px-4 py-3 text-sm">
                      {s.events.map((e, i) => {
                        const d = describeEvent(e);
                        return (
                          <li key={i} className={cn("flex items-start gap-2.5", d.highlight ? "text-foreground" : "text-muted-foreground")}>
                            <span className={cn("mt-0.5", d.highlight ? "text-emerald-400" : "")}>{d.icon}</span>
                            <span className="flex-1">{d.text}</span>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                              {new Date(e.t).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </li>
                        );
                      })}
                      {s.sections.length > 0 && (
                        <li className="flex items-start gap-2.5 text-muted-foreground">
                          <span className="mt-0.5">↓</span>
                          <span>Scrolled through {s.sections.map((id) => sectionName[id] ?? id).join(" → ")}</span>
                        </li>
                      )}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 justify-end border-t border-border/70 bg-card/40 px-5 py-4">
        <Button variant="danger" loading={deleting} icon={<Trash2 className="h-4 w-4" />} onClick={forget} disabled={!detail}>
          Forget this visitor
        </Button>
      </div>
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
