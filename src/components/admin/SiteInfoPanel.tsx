import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Clock, ExternalLink, Link2, Mail, MapPin, Phone, RotateCcw, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { PUBLIC_SETTING_KEYS, SITE_DEFAULTS, whatsappLink, type SiteInfo } from "../../lib/site";
import { IconWhatsApp, SOCIAL_LINKS } from "../site/icons";
import type { PanelProps } from "./types";
import { Button, Card, CardHeader, Field, PageHeader, Skeleton } from "./ui";
import { describeError, EMAIL_RE, isValidUrl, normaliseUrl } from "./utils";

const PLACEHOLDERS: Partial<Record<keyof SiteInfo, string>> = {
  social_twitter: "x.com/yourname",
  social_instagram: "instagram.com/yourname",
  social_facebook: "facebook.com/yourpage",
  social_linkedin: "linkedin.com/company/yourpage",
  social_github: "github.com/yourname",
};

function fromSettings(settings: Record<string, string>): SiteInfo {
  const info = { ...SITE_DEFAULTS };
  for (const key of PUBLIC_SETTING_KEYS) {
    if (settings[key] != null) info[key] = settings[key];
    else if (key.startsWith("social_")) info[key] = "";
  }
  return info;
}

export function SiteInfoPanel({ data, loading, setData }: PanelProps) {
  const ids = useId();
  const saved = useMemo(() => fromSettings(data.settings), [data.settings]);
  const [draft, setDraft] = useState<SiteInfo>(saved);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(saved), [saved]);

  const dirty = PUBLIC_SETTING_KEYS.some((k) => draft[k].trim() !== saved[k].trim());

  // Warn before leaving the page with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const errors: Partial<Record<keyof SiteInfo, string>> = {};
  if (draft.contact_email.trim() && !EMAIL_RE.test(draft.contact_email.trim())) errors.contact_email = "That email address doesn't look right.";
  if (draft.contact_phone_raw && !/^\d{8,15}$/.test(draft.contact_phone_raw)) errors.contact_phone_raw = "Use the full international number, digits only (8–15 digits).";
  for (const { key } of SOCIAL_LINKS) if (!isValidUrl(draft[key])) errors[key] = "That doesn't look like a valid link.";
  const hasErrors = Object.keys(errors).length > 0;

  const set = (key: keyof SiteInfo, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    if (hasErrors) return toast.error("Fix the highlighted fields first.");
    setSaving(true);
    const entries = PUBLIC_SETTING_KEYS.map((key) => {
      let value = draft[key].trim();
      if (key.startsWith("social_")) value = normaliseUrl(value);
      if (key === "contact_phone_raw") value = value.replace(/\D/g, "");
      return { key, value };
    });
    const { error } = await supabase.from("site_settings").upsert(entries);
    setSaving(false);
    if (error) return toast.error(describeError(error, "Couldn't save site info"));
    setData((d) => ({ ...d, settings: { ...d.settings, ...Object.fromEntries(entries.map((e) => [e.key, e.value])) } }));
    toast.success("Site info saved — it's live now");
  }

  const derivedDigits = draft.contact_phone.replace(/\D/g, "");
  const activeSocials = SOCIAL_LINKS.filter(({ key }) => draft[key].trim());

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className={cn(dirty && "pb-20")}>
      <PageHeader title="Site info" description="Contact details and links shown in the hero, contact section, footer and WhatsApp buttons." />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Mail className="h-4 w-4" />} title="Contact details" description="How visitors reach you." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Email address" htmlFor={`${ids}-email`} error={errors.contact_email} className="sm:col-span-2">
                <input id={`${ids}-email`} type="email" className="field-input text-sm" value={draft.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="redsparkdigital@gmail.com" />
              </Field>
              <Field label="Phone (as displayed)" htmlFor={`${ids}-phone`} hint="Shown to visitors and used for call links, e.g. +264 81 873 6612">
                <input id={`${ids}-phone`} type="tel" className="field-input text-sm" value={draft.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+264 81 873 6612" />
              </Field>
              <Field
                label="WhatsApp number"
                htmlFor={`${ids}-raw`}
                error={errors.contact_phone_raw}
                hint="Digits only with country code — used for WhatsApp links. Can differ from the displayed number."
                action={
                  derivedDigits && derivedDigits !== draft.contact_phone_raw ? (
                    <button type="button" className="text-[11px] font-semibold text-primary hover:text-primary-glow" onClick={() => set("contact_phone_raw", derivedDigits)}>
                      Copy displayed number
                    </button>
                  ) : undefined
                }
              >
                <div className="flex gap-2">
                  <input
                    id={`${ids}-raw`}
                    inputMode="numeric"
                    className="field-input min-w-0 flex-1 font-mono text-sm"
                    value={draft.contact_phone_raw}
                    onChange={(e) => set("contact_phone_raw", e.target.value.replace(/\D/g, ""))}
                    placeholder="264818736612"
                  />
                  {draft.contact_phone_raw && !errors.contact_phone_raw && (
                    <a
                      href={whatsappLink(draft.contact_phone_raw)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Test WhatsApp link"
                      className="inline-flex h-auto w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <IconWhatsApp className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Building2 className="h-4 w-4" />} title="Business" description="Shown in the hero badge, about, contact and footer." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Location" htmlFor={`${ids}-loc`}>
                <input id={`${ids}-loc`} className="field-input text-sm" value={draft.business_location} onChange={(e) => set("business_location", e.target.value)} placeholder="Windhoek, Namibia" />
              </Field>
              <Field label="Opening hours" htmlFor={`${ids}-hours`} optional>
                <input id={`${ids}-hours`} className="field-input text-sm" value={draft.business_hours} onChange={(e) => set("business_hours", e.target.value)} placeholder="Mon–Fri, 08:00–17:00" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Link2 className="h-4 w-4" />} title="Social links" description="Leave blank to hide that icon. “https://” is added for you." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {SOCIAL_LINKS.map(({ key, label, Icon }) => (
                <Field
                  key={key}
                  label={label}
                  htmlFor={`${ids}-${key}`}
                  error={errors[key]}
                  action={
                    draft[key] && !errors[key] ? (
                      <a href={normaliseUrl(draft[key])} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label={`Open ${label}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : undefined
                  }
                >
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id={`${ids}-${key}`}
                      inputMode="url"
                      className="field-input pl-9 text-sm"
                      value={draft[key]}
                      onChange={(e) => set(key, e.target.value)}
                      onBlur={() => set(key, normaliseUrl(draft[key]))}
                      placeholder={PLACEHOLDERS[key]}
                    />
                  </div>
                </Field>
              ))}
            </div>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Footer preview</p>
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <p className="text-sm font-semibold">Contact</p>
            <div className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {draft.contact_email && (
                <p className="flex items-center gap-2.5 break-all">
                  <Mail className="h-4 w-4 shrink-0 text-accent" />
                  {draft.contact_email}
                </p>
              )}
              {draft.contact_phone && (
                <p className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-accent" />
                  {draft.contact_phone}
                </p>
              )}
              {draft.contact_phone_raw && (
                <p className="flex items-center gap-2.5">
                  <IconWhatsApp className="h-4 w-4 shrink-0 text-emerald-400" />
                  WhatsApp
                </p>
              )}
              {draft.business_location && (
                <p className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0 text-accent" />
                  {draft.business_location}
                </p>
              )}
              {draft.business_hours && (
                <p className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-accent" />
                  {draft.business_hours}
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-border/60 pt-4">
              {activeSocials.length ? (
                <div className="flex flex-wrap gap-2">
                  {activeSocials.map(({ key, label, Icon }) => (
                    <span key={key} title={label} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">No social links — the icons row is hidden.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur animate-pop-in lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="text-sm">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />
              Unsaved changes
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setDraft(saved)}>
                Discard
              </Button>
              <Button variant="primary" loading={saving} disabled={hasErrors} icon={<Save className="h-4 w-4" />} onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
