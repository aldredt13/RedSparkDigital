/**
 * Shared public site data: display settings, pricing plans, and the
 * "request this service / package" hand-off into the contact form.
 *
 * Each dataset is fetched once per page load and shared by every component
 * that asks for it (Footer, Contact, Pricing, floating WhatsApp button…).
 */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// ─── Site settings ────────────────────────────────────────────────────────────

export type SiteInfo = {
  contact_email: string;
  contact_phone: string;
  /** Digits only, used for wa.me / tel: links */
  contact_phone_raw: string;
  business_location: string;
  business_hours: string;
  social_twitter: string;
  social_instagram: string;
  social_github: string;
  social_facebook: string;
  social_linkedin: string;
};

export const SITE_DEFAULTS: SiteInfo = {
  contact_email: "redsparkdigital@gmail.com",
  contact_phone: "+264 81 873 6612",
  contact_phone_raw: "264818736612",
  business_location: "Windhoek, Namibia",
  business_hours: "Mon–Fri, 08:00–17:00",
  social_twitter: "",
  social_instagram: "",
  social_github: "",
  social_facebook: "",
  social_linkedin: "",
};

/** Keys visitors are allowed to read (matches the RLS policy). */
export const PUBLIC_SETTING_KEYS = Object.keys(SITE_DEFAULTS) as Array<keyof SiteInfo>;

let settingsPromise: Promise<SiteInfo> | null = null;

function loadSiteInfo(): Promise<SiteInfo> {
  settingsPromise ??= (async () => {
    const { data, error } = await supabase.from("site_settings").select("key, value").in("key", PUBLIC_SETTING_KEYS);
    if (error || !data) return SITE_DEFAULTS;
    const map = Object.fromEntries(data.map((row: { key: string; value: string }) => [row.key, row.value?.trim() ?? ""]));
    const info = { ...SITE_DEFAULTS };
    for (const key of PUBLIC_SETTING_KEYS) {
      const value = map[key];
      // Contact/business fields fall back to defaults; socials stay empty (= hidden)
      if (key.startsWith("social_")) info[key] = value ?? "";
      else if (value) info[key] = value;
    }
    return info;
  })();
  return settingsPromise;
}

export function useSiteInfo(): SiteInfo {
  const [info, setInfo] = useState<SiteInfo>(SITE_DEFAULTS);
  useEffect(() => {
    let alive = true;
    loadSiteInfo().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

/** Call link for the displayed number (the WhatsApp number can be a different line). */
export function telLink(displayPhone: string, phoneRaw: string): string {
  const shown = displayPhone.trim();
  if (shown) return `tel:${shown.startsWith("+") ? "+" : ""}${shown.replace(/\D/g, "")}`;
  return `tel:+${phoneRaw.replace(/\D/g, "")}`;
}

export function whatsappLink(phoneRaw: string, text?: string): string {
  const base = `https://wa.me/${phoneRaw.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// ─── Pricing plans ────────────────────────────────────────────────────────────

export type PublicPlan = {
  id: string;
  name: string;
  description: string;
  highlight: boolean;
  sort_order: number;
  price_usd_cents: number;
  features: string[];
};

let plansPromise: Promise<PublicPlan[]> | null = null;

function loadPlans(): Promise<PublicPlan[]> {
  plansPromise ??= (async () => {
    const { data, error } = await supabase.from("pricing_plans_full").select("*").order("sort_order");
    if (error) {
      plansPromise = null; // allow a retry on the next mount
      throw error;
    }
    return ((data ?? []) as PublicPlan[]).map((p) => ({ ...p, features: p.features ?? [] }));
  })();
  return plansPromise;
}

export function usePlans() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadPlans()
      .then((p) => alive && setPlans(p))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load pricing."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  return { plans, loading, error };
}

// ─── Services + contact hand-off ──────────────────────────────────────────────

export const SERVICE_OPTIONS = [
  "Website Development",
  "PC Setup & Optimization",
  "Windows Installation",
  "Software Installation",
] as const;

export const CUSTOM_PACKAGE = "Custom package";
export const OTHER_SERVICE = "Something else";

/** Package enquiries are stored in `contact_submissions.service` with this prefix. */
export const PACKAGE_PREFIX = "Package: ";

export function packageValue(planName: string) {
  return `${PACKAGE_PREFIX}${planName}`;
}

export function isPackageValue(service: string) {
  return service.startsWith(PACKAGE_PREFIX);
}

export function packageName(service: string) {
  return isPackageValue(service) ? service.slice(PACKAGE_PREFIX.length) : null;
}

const SELECT_EVENT = "redspark:select-service";
let pendingSelection: string | null = null;

/** Scroll to the contact form and pre-select a service, package or custom quote. */
export function requestService(service: string) {
  pendingSelection = service;
  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: { service } }));
}

export function onServiceRequested(handler: (service: string) => void) {
  if (pendingSelection) handler(pendingSelection);
  const listener = (e: Event) => handler((e as CustomEvent<{ service: string }>).detail.service);
  window.addEventListener(SELECT_EVENT, listener);
  return () => window.removeEventListener(SELECT_EVENT, listener);
}
