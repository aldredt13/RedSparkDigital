/**
 * Contact.tsx — Enhanced UI
 *
 * Key input-visibility fixes:
 *  • Solid #1c1c1e dark background on every input — no transparency tricks
 *  • 1.5px #4a4a4a border at rest → bright primary on focus
 *  • White text (#f2f2f2) inside fields so typed text is always legible
 *  • Placeholder at 45% opacity so it's readable but clearly secondary
 *  • Hover state bumps border to #6a6a6a for tactile feedback
 *  • Focus adds 3px primary glow ring so active field is obvious
 *  • Select dropdown uses same solid bg — no OS default bleeding through
 *  • Textarea gets explicit pb-6 to give room for the char counter
 */

import { Mail, MessageCircle, Phone, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

// ─── Service options — keep in sync with Services.tsx ────────────────────────
const SERVICE_OPTIONS = [
  "Website Development",
  "PC Setup & Optimization",
  "Windows Installation",
  "Software Installation",
  "Other",
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
};

const BLANK: FormState = {
  name: "",
  email: "",
  phone: "",
  service: SERVICE_OPTIONS[0],
  message: "",
};

// ─── Site info types + defaults ───────────────────────────────────────────────

type SiteSetting = { key: string; value: string };

type SiteInfo = {
  contact_email: string;
  contact_phone: string;
  contact_phone_raw: string;
  discord_webhook_url: string;
  discord_notifications_enabled: string;
};

const INFO_DEFAULTS: SiteInfo = {
  contact_email:    "redsparkdigital@gmail.com",
  contact_phone:    "+264 81 873 6612",
  contact_phone_raw:"264818736612",
  discord_webhook_url: "",
  discord_notifications_enabled: "true",
};

// ─── postToDiscord — exact same helper as AdminDashboard ─────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────
export function Contact() {
  const [form, setForm] = useState<FormState>(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(INFO_DEFAULTS);

  // ── Fetch site settings on mount — same pattern as AdminDashboard.fetchAll ──
  useEffect(() => {
    supabase
      .from("site_settings")
      .select("key, value")
      .then(({ data, error: fetchErr }) => {
        if (fetchErr) { console.error("[Contact] site_settings fetch error:", fetchErr); return; }
        if (!data) return;
        const map: Record<string, string> = {};
        (data as SiteSetting[]).forEach((s) => { map[s.key] = s.value; });

        const webhookUrl = map["discord_webhook_url"]?.trim() ?? "";
        console.log("[Contact] discord_webhook_url loaded:", webhookUrl ? "✓ set" : "⚠ empty");

        setSiteInfo({
          contact_email:    map["contact_email"]?.trim()     || INFO_DEFAULTS.contact_email,
          contact_phone:    map["contact_phone"]?.trim()     || INFO_DEFAULTS.contact_phone,
          contact_phone_raw:map["contact_phone_raw"]?.trim() || INFO_DEFAULTS.contact_phone_raw,
          discord_webhook_url:           webhookUrl,
          discord_notifications_enabled: map["discord_notifications_enabled"]?.trim() ?? "true",
        });
      });
  }, []);

  // Pre-select service when navigated from Services/Pricing cards
  useEffect(() => {
    function handleSelectService(e: Event) {
      const { service } = (e as CustomEvent<{ service: string }>).detail;
      if (SERVICE_OPTIONS.includes(service)) {
        setForm((f) => ({ ...f, service }));
        if (selectRef.current) {
          selectRef.current.classList.add("ci-highlight");
          setTimeout(() => selectRef.current?.classList.remove("ci-highlight"), 900);
        }
      }
    }
    window.addEventListener("redspark:select-service", handleSelectService);
    return () => window.removeEventListener("redspark:select-service", handleSelectService);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      // 1. Save to Supabase
      const { error: dbError } = await supabase
        .from("contact_submissions")
        .insert({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          service: form.service,
          message: form.message.trim(),
        });

      if (dbError) throw new Error(dbError.message);

      // 2. Post to Discord — mirrors AdminDashboard.sendTestDiscordNotification exactly.
      //    Uses siteInfo already loaded in state (same pattern as discordSettings in admin).
      const webhookUrl = siteInfo.discord_webhook_url.trim();
      const notificationsEnabled = siteInfo.discord_notifications_enabled !== "false";

      console.log("[Contact] handleSubmit — webhook:", webhookUrl ? "✓ set" : "⚠ empty", "| enabled:", notificationsEnabled);

      if (notificationsEnabled && webhookUrl) {
        await postToDiscord(webhookUrl, {
          embeds: [{
            title: "📬 New Contact Form Submission",
            color: 0xe05555,
            fields: [
              { name: "Name",    value: form.name.trim()             || "—", inline: true  },
              { name: "Email",   value: form.email.trim()            || "—", inline: true  },
              { name: "Service", value: form.service                 || "—", inline: true  },
              { name: "Phone",   value: form.phone.trim()            || "—", inline: true  },
              { name: "Message", value: form.message.trim().slice(0, 1024), inline: false },
            ],
            footer: { text: "RedSpark Digital · Contact Form" },
            timestamp: new Date().toISOString(),
          }],
        });
        console.log("[Contact] Discord notification sent ✓");
      } else {
        console.warn("[Contact] Discord skipped — webhook empty or notifications disabled.");
      }

      setSent(true);
      setForm(BLANK);
    } catch (err: unknown) {
      console.error("[Contact] handleSubmit error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Contact</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Let's get your tech sorted</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Tell us what you need — we usually reply within hours.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-5 max-w-5xl mx-auto items-start">

          {/* ── Left: contact channels ── */}
          <div className="md:col-span-2 space-y-3">
            {siteInfo.contact_phone_raw && (
              <ContactCard
                href={`https://wa.me/${siteInfo.contact_phone_raw}`}
                icon={<MessageCircle className="h-5 w-5" />}
                iconClass="bg-emerald-500/15 text-emerald-400"
                label="WhatsApp"
                value="Chat with us"
                badge="Fastest reply"
              />
            )}
            {siteInfo.contact_email && (
              <ContactCard
                href={`mailto:${siteInfo.contact_email}`}
                icon={<Mail className="h-5 w-5" />}
                iconClass="bg-primary/15 text-primary"
                label="Email"
                value={siteInfo.contact_email}
              />
            )}
            {siteInfo.contact_phone && (
              <ContactCard
                href={`tel:+${siteInfo.contact_phone_raw || siteInfo.contact_phone.replace(/[^\d]/g, "")}`}
                icon={<Phone className="h-5 w-5" />}
                iconClass="bg-accent/15 text-accent"
                label="Phone"
                value={siteInfo.contact_phone}
              />
            )}

            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Based in <strong className="text-foreground/80">Windhoek, Namibia</strong> — serving
                clients locally and across Southern Africa. Remote support available nationwide.
              </p>
            </div>
          </div>

          {/* ── Right: form card ── */}
          <div className="md:col-span-3 rounded-2xl border border-border/60 bg-(image:--gradient-card) backdrop-blur p-6 md:p-8 shadow-(--shadow-elegant)">
            {sent ? (
              <SuccessState onReset={() => setSent(false)} phoneRaw={siteInfo.contact_phone_raw} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                {/* Row 1: Name + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Your Name">
                    <input
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="ci"
                      placeholder="John Doe"
                      autoComplete="name"
                    />
                  </FormField>

                  <FormField label="Email Address">
                    <input
                      required
                      type="email"
                      maxLength={255}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="ci"
                      placeholder="you@email.com"
                      autoComplete="email"
                    />
                  </FormField>
                </div>

                {/* Row 2: Phone + Service */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Phone Number (optional)">
                    <input
                      type="tel"
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="ci"
                      placeholder="+264 81 000 0000"
                      autoComplete="tel"
                    />
                  </FormField>

                  <FormField label="Service Required">
                    <div className="ci-wrap">
                      <select
                        ref={selectRef}
                        value={form.service}
                        onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                        className="ci ci-select"
                      >
                        {SERVICE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {/* Custom chevron — sits above the select */}
                      <div className="ci-chevron" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.75"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </FormField>
                </div>

                {/* Row 3: Message */}
                <FormField label="Message">
                  <div className="ci-wrap">
                    <textarea
                      required
                      maxLength={1000}
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      className="ci ci-textarea"
                      placeholder="Tell us what you need — the more detail, the better..."
                    />
                    <span className="ci-counter">{form.message.length}/1000</span>
                  </div>
                </FormField>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    <span className="mt-px shrink-0">⚠</span>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-(image:--gradient-primary) px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-(--shadow-elegant) hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                  ) : (
                    <><Send className="h-4 w-4" />Send Message</>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground/50">
                  We respect your privacy. Your info is never shared.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Scoped input styles ── */}
      <style>{`
        /* ── Base input / textarea / select ────────────────────────────────── */
        .ci {
          width: 100%;
          /* Solid opaque background — clearly distinct from the card surface */
          background: #111113;
          border: 1.5px solid #3d3d42;
          border-radius: 0.625rem;
          padding: 0.75rem 1rem;
          font-size: 0.9375rem;
          line-height: 1.5;
          /* Always white so typed text is legible on the dark bg */
          color: #f2f2f5;
          outline: none;
          font-family: inherit;
          transition:
            border-color 0.15s ease,
            box-shadow   0.15s ease,
            background   0.15s ease;
        }

        /* Placeholder — visible but clearly secondary */
        .ci::placeholder {
          color: rgba(255, 255, 255, 0.38);
        }

        /* Hover — border brightens so the field feels interactive */
        .ci:hover {
          border-color: #5c5c64;
          background: #141416;
        }

        /* Focus — bright primary border + soft glow ring */
        .ci:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.20);
          background: #16161a;
        }

        /* Highlight flash when pre-selected by Services / Pricing */
        .ci-highlight {
          border-color: hsl(var(--primary)) !important;
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.25) !important;
        }

        /* ── Select specific ─────────────────────────────────────────────── */
        .ci-select {
          /* Remove OS arrow so our custom chevron shows */
          appearance: none;
          -webkit-appearance: none;
          /* Extra right padding so text doesn't overlap the chevron */
          padding-right: 2.5rem;
          cursor: pointer;
        }

        /* Dropdown options — solid dark bg, white text */
        .ci-select option {
          background: #1e1e22;
          color: #f2f2f5;
        }

        /* ── Textarea specific ───────────────────────────────────────────── */
        .ci-textarea {
          resize: none;
          /* Extra bottom padding so text never sits under the counter */
          padding-bottom: 1.75rem;
        }

        /* ── Wrapper for select / textarea (positions overlay elements) ──── */
        .ci-wrap {
          position: relative;
        }

        /* Custom chevron for select */
        .ci-chevron {
          pointer-events: none;
          position: absolute;
          right: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.45);
          display: flex;
          align-items: center;
        }

        /* Character counter for textarea */
        .ci-counter {
          position: absolute;
          bottom: 0.625rem;
          right: 0.875rem;
          font-size: 0.6875rem;
          color: rgba(255, 255, 255, 0.3);
          pointer-events: none;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
      `}</style>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}

function ContactCard({
  href,
  icon,
  iconClass,
  label,
  value,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="relative flex items-center gap-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4 hover:border-primary/50 hover:bg-card/80 transition-all duration-200 group"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass} transition-transform group-hover:scale-110 duration-200`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold text-sm truncate">{value}</div>
      </div>
      {badge && (
        <span className="absolute top-2 right-2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          {badge}
        </span>
      )}
    </a>
  );
}

function SuccessState({ onReset, phoneRaw }: { onReset: () => void; phoneRaw: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div
          className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping"
          style={{ animationDuration: "1.5s" }}
        />
      </div>
      <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
      <p className="text-muted-foreground max-w-xs mb-6">
        Thanks for reaching out. We'll be in touch within a few hours — usually much sooner.
      </p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {phoneRaw && (
        <a
          href={`https://wa.me/${phoneRaw}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500/25 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Follow up on WhatsApp
        </a>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          Send another
        </button>
      </div>
    </div>
  );
}