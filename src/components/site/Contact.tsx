import { Mail, Phone, Send, CheckCircle2, Loader2, MapPin, Clock, AlertCircle, Check, Package, Layers } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { track } from "../../lib/analytics";
import { formatPrice, formatUsd, useCurrency } from "../../lib/currency";
import {
  CUSTOM_PACKAGE,
  OTHER_SERVICE,
  SERVICE_OPTIONS,
  isPackageValue,
  onServiceRequested,
  packageName,
  packageValue,
  telLink,
  usePlans,
  useSiteInfo,
  whatsappLink,
} from "../../lib/site";
import { IconWhatsApp } from "./icons";
import { SectionHeader } from "./SectionHeader";

type FormState = {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  /** Honeypot — real visitors never see or fill this */
  company: string;
};

type Errors = Partial<Record<"name" | "email" | "service" | "message", string>>;

const BLANK: FormState = { name: "", email: "", phone: "", service: "", message: "", company: "" };
const MESSAGE_MAX = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = "Please tell us your name.";
  if (!f.email.trim()) errors.email = "We need an email address to reply to.";
  else if (!EMAIL_RE.test(f.email.trim())) errors.email = "That email address doesn't look right.";
  if (!f.service) errors.service = "Choose a service or package.";
  if (f.message.trim().length < 10) errors.message = "Add a little more detail so we can help (10+ characters).";
  return errors;
}

function messagePlaceholder(service: string) {
  if (service === CUSTOM_PACKAGE) return "Which services would you like combined? Any deadline or budget we should know about?";
  if (isPackageValue(service)) return "Anything we should know about your setup or timeline?";
  if (service === SERVICE_OPTIONS[0]) return "What's the website for? Do you have a domain or examples you like?";
  return "Tell us what you need — the more detail, the better.";
}

export function Contact() {
  const site = useSiteInfo();
  const { plans } = usePlans();
  const { currency } = useCurrency();
  const formId = useId();

  const [form, setForm] = useState<FormState>(BLANK);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ name: string; service: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  // Pre-select when a visitor clicks "Request this service" / "Choose package" elsewhere on the page
  useEffect(
    () =>
      onServiceRequested((service) => {
        setSent(null);
        setForm((f) => ({ ...f, service }));
        setErrors((e) => ({ ...e, service: undefined }));
        setFlashKey((k) => k + 1);
      }),
    [],
  );

  const selectedPlan = useMemo(() => {
    const name = packageName(form.service);
    return name ? plans.find((p) => p.name === name) ?? null : null;
  }, [form.service, plans]);

  // Keep a pre-selected package visible even if it isn't in the loaded plan list
  const packageOptions = useMemo(() => {
    const opts = plans.map((p) => ({ value: packageValue(p.name), label: `${p.name} — from ${formatPrice(p.price_usd_cents, currency)}` }));
    if (isPackageValue(form.service) && !opts.some((o) => o.value === form.service)) {
      opts.push({ value: form.service, label: packageName(form.service) ?? form.service });
    }
    return opts;
  }, [plans, currency, form.service]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof Errors]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onBlur(key: "name" | "email" | "message") {
    const message = validate(form)[key];
    // Only show blur errors for fields the visitor has started on
    if (message && form[key].length > 0) setErrors((e) => ({ ...e, [key]: message }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const found = validate(form);
    setErrors(found);
    const firstInvalid = (["name", "email", "service", "message"] as const).find((k) => found[k]);
    if (firstInvalid) {
      track("contact_invalid", { fields: Object.keys(found).join(",") });
      document.getElementById(`${formId}-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // Bots fill every field — quietly pretend it worked
      if (!form.company) {
        const { error } = await supabase.from("contact_submissions").insert({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          service: form.service,
          message: form.message.trim(),
        });
        if (error) throw new Error(error.message);
        track("contact_submit", { service: form.service });
        // Discord alerts are sent by the database itself (see supabase/sql/01_security_and_notifications.sql)
      }
      setSent({ name: form.name.trim().split(" ")[0], service: form.service });
      setForm(BLANK);
      setErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setSubmitError(
        /too many messages/i.test(msg)
          ? msg
          : "Sorry — your message couldn't be sent. Please try again, or reach us on WhatsApp or email instead.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" aria-labelledby="contact-title" className="relative overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" aria-hidden />

      <div className="container relative mx-auto px-4">
        <SectionHeader
          id="contact-title"
          align="center"
          eyebrow="Contact"
          title="Let's get your tech sorted"
          description="Tell us what you need — we usually reply within hours."
        />

        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Channels */}
          <div className="space-y-3">
            {site.contact_phone_raw && (
              <ContactCard
                href={whatsappLink(site.contact_phone_raw, "Hi RedSpark Digital, I'd like some help with…")}
                icon={<IconWhatsApp className="h-5 w-5" />}
                iconClass="bg-emerald-500/15 text-emerald-400"
                label="WhatsApp"
                value="Chat with us"
                badge="Fastest reply"
              />
            )}
            {site.contact_email && (
              <ContactCard
                href={`mailto:${site.contact_email}`}
                icon={<Mail className="h-5 w-5" />}
                iconClass="bg-primary/15 text-primary"
                label="Email"
                value={site.contact_email}
              />
            )}
            {site.contact_phone && (
              <ContactCard
                href={telLink(site.contact_phone, site.contact_phone_raw)}
                icon={<Phone className="h-5 w-5" />}
                iconClass="bg-accent/15 text-accent"
                label="Phone"
                value={site.contact_phone}
              />
            )}

            <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-5 text-sm backdrop-blur">
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-muted-foreground">
                  Based in <strong className="font-semibold text-foreground">{site.business_location}</strong> — on-site locally, remote
                  support nationwide and across Southern Africa.
                </span>
              </p>
              {site.business_hours && (
                <p className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-muted-foreground">{site.business_hours}</span>
                </p>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-border/60 bg-(image:--gradient-card) p-6 shadow-(--shadow-elegant) backdrop-blur md:p-8">
            {sent ? (
              <SuccessState sent={sent} phoneRaw={site.contact_phone_raw} onReset={() => setSent(null)} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-describedby={submitError ? `${formId}-error` : undefined}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id={`${formId}-name`} label="Your name" error={errors.name} required>
                    <input
                      id={`${formId}-name`}
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      onBlur={() => onBlur("name")}
                      className="field-input"
                      placeholder="Jane Doe"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? `${formId}-name-error` : undefined}
                    />
                  </Field>
                  <Field id={`${formId}-email`} label="Email address" error={errors.email} required>
                    <input
                      id={`${formId}-email`}
                      type="email"
                      inputMode="email"
                      maxLength={255}
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      onBlur={() => onBlur("email")}
                      className="field-input"
                      placeholder="you@email.com"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id={`${formId}-phone`} label="Phone / WhatsApp" hint="Optional">
                    <input
                      id={`${formId}-phone`}
                      type="tel"
                      inputMode="tel"
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="field-input"
                      placeholder="+264 81 000 0000"
                      autoComplete="tel"
                    />
                  </Field>
                  <Field id={`${formId}-service`} label="What do you need?" error={errors.service} required>
                    <select
                      key={flashKey}
                      id={`${formId}-service`}
                      value={form.service}
                      onChange={(e) => update("service", e.target.value)}
                      className={`field-input ${flashKey ? "flash-ring" : ""} ${form.service ? "" : "text-muted-foreground"}`}
                      aria-invalid={!!errors.service}
                      aria-describedby={errors.service ? `${formId}-service-error` : undefined}
                    >
                      <option value="" disabled>
                        Choose a service or package…
                      </option>
                      <optgroup label="Services">
                        {SERVICE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </optgroup>
                      {packageOptions.length > 0 && (
                        <optgroup label="Packages">
                          {packageOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Something else">
                        <option value={CUSTOM_PACKAGE}>Custom package (mix &amp; match)</option>
                        <option value={OTHER_SERVICE}>Something else</option>
                      </optgroup>
                    </select>
                  </Field>
                </div>

                {selectedPlan && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 animate-fade-in">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Package className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{selectedPlan.name}</p>
                          <p className="text-xs text-muted-foreground">Starting price · final quote after assessment</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-bold">{formatPrice(selectedPlan.price_usd_cents, currency)}</p>
                        {currency.code !== "USD" && <p className="text-[11px] text-muted-foreground">≈ {formatUsd(selectedPlan.price_usd_cents)} USD</p>}
                      </div>
                    </div>
                    {selectedPlan.features.length > 0 && (
                      <ul className="mt-3 grid gap-1.5 border-t border-primary/15 pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                        {selectedPlan.features.slice(0, 6).map((f, i) => (
                          <li key={`${i}-${f}`} className="flex items-start gap-1.5">
                            <Check className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {form.service === CUSTOM_PACKAGE && (
                  <div className="flex items-start gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm animate-fade-in">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-muted-foreground">
                      Tell us which services you'd like combined
                      {plans.length > 0 && <> — or start from a package like “{plans[0].name}” and say what to add</>}. We'll send back a
                      tailored quote.
                    </p>
                  </div>
                )}

                <Field id={`${formId}-message`} label="Message" error={errors.message} required>
                  <div className="relative">
                    <textarea
                      id={`${formId}-message`}
                      maxLength={MESSAGE_MAX}
                      rows={5}
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      onBlur={() => onBlur("message")}
                      className="field-input pb-7"
                      placeholder={messagePlaceholder(form.service)}
                      aria-invalid={!!errors.message}
                      aria-describedby={errors.message ? `${formId}-message-error` : undefined}
                    />
                    <span
                      className={`pointer-events-none absolute bottom-2.5 right-3.5 text-[11px] tabular-nums ${
                        form.message.length > MESSAGE_MAX * 0.9 ? "text-warning" : "text-muted-foreground/60"
                      }`}
                    >
                      {form.message.length}/{MESSAGE_MAX}
                    </span>
                  </div>
                </Field>

                {/* Honeypot */}
                <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
                  <label>
                    Company
                    <input tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => update("company", e.target.value)} />
                  </label>
                </div>

                {submitError && (
                  <div id={`${formId}-error`} role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-(image:--gradient-primary) px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-(--shadow-elegant) transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send message
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-muted-foreground/60">We respect your privacy — your details are only used to reply to you.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-foreground/70">
        <span>
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </span>
        {hint && <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground/70">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs text-red-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
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
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string;
  badge?: string;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur transition-all duration-200 hover:border-primary/50 hover:bg-card/80"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass} transition-transform duration-200 group-hover:scale-110`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-semibold">{value}</span>
      </span>
      {badge && (
        <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
          {badge}
        </span>
      )}
    </a>
  );
}

function SuccessState({ sent, phoneRaw, onReset }: { sent: { name: string; service: string }; phoneRaw: string; onReset: () => void }) {
  const about = packageName(sent.service) ?? sent.service;
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-pop-in" role="status">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="absolute inset-0 animate-ping rounded-full border-2 border-emerald-500/30 [animation-duration:1.6s] [animation-iteration-count:2]" />
      </div>
      <h3 className="text-2xl font-bold">Thanks{sent.name ? `, ${sent.name}` : ""}!</h3>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Your enquiry about <strong className="text-foreground">{about}</strong> is in. We'll be in touch within a few hours — usually much sooner.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {phoneRaw && (
          <a
            href={whatsappLink(phoneRaw, `Hi RedSpark Digital, I just sent an enquiry about ${about}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >
            <IconWhatsApp className="h-4 w-4" />
            Follow up on WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Send another
        </button>
      </div>
    </div>
  );
}
