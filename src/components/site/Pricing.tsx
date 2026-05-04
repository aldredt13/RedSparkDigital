/**
 * Pricing.tsx — dynamic, DB-driven, currency-aware
 *
 * Changes from previous version:
 *  • "Get Started" button now deep-links to the Contact section AND
 *    pre-selects the closest matching service via the
 *    "redspark:select-service" CustomEvent (same mechanism as Services.tsx).
 *    Since pricing plan names don't map 1:1 to service options, the plan
 *    name is passed as the service value. Contact.tsx will gracefully fall
 *    through to "Other" if it's not an exact match — this is intentional
 *    so the form still has context (see note below).
 *
 *  NOTE: If you want pricing plans to pre-select specific services, name
 *  them exactly as they appear in SERVICE_OPTIONS in Contact.tsx, OR add
 *  an optional `contactService` field to each plan in the DB.
 *  For now, we pass plan.name so the admin sees which plan the client
 *  clicked — it arrives in the form's service field if it matches, or
 *  falls back gracefully.
 */

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string;
  name: string;
  description: string;
  highlight: boolean;
  sort_order: number;
  price_usd_cents: number;
  features: string[];
};

type Currency = {
  code: string;
  symbol: string;
  rate: number;
};

// ─── Currency symbol map ──────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",  EUR: "€",  GBP: "£",  JPY: "¥",  AUD: "A$",
  CAD: "C$", CHF: "Fr", CNY: "¥",  HKD: "HK$", SGD: "S$",
  ZAR: "R",  NAD: "N$", BWP: "P",  ZMW: "ZK", MWK: "MK",
  NGN: "₦",  GHS: "₵",  KES: "KSh", TZS: "TSh", UGX: "USh",
  INR: "₹",  BRL: "R$", MXN: "MX$", AED: "AED", SAR: "SR",
  NZD: "NZ$", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł",
  CZK: "Kč", HUF: "Ft", RON: "lei", TRY: "₺",  RUB: "₽",
  IDR: "Rp", THB: "฿",  PHP: "₱",  MYR: "RM",  VND: "₫",
  PKR: "₨",  BDT: "৳",  LKR: "Rs", EGP: "E£",  MAD: "MAD",
  CLP: "CLP$", COP: "COL$", PEN: "S/.", ARS: "AR$", ILS: "₪",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function convertPrice(usdCents: number, rate: number): number {
  const usd = usdCents / 100;
  return Math.ceil(usd * rate);
}

function formatPrice(amount: number, currency: Currency): string {
  return `${currency.symbol}${amount.toLocaleString()}`;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function detectCurrency(): Promise<Currency> {
  try {
    const geoRes = await fetch("https://ip-api.com/json/?fields=countryCode,currency", {
      signal: AbortSignal.timeout(4000),
    });
    if (!geoRes.ok) throw new Error("geo failed");
    const geo = await geoRes.json();
    const currencyCode: string = geo.currency ?? "USD";

    const fxRes = await fetch(`https://open.er-api.com/v6/latest/USD`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!fxRes.ok) throw new Error("fx failed");
    const fx = await fxRes.json();
    const rate: number = fx.rates?.[currencyCode] ?? 1;

    return {
      code: currencyCode,
      symbol: CURRENCY_SYMBOLS[currencyCode] ?? currencyCode + " ",
      rate,
    };
  } catch {
    return { code: "USD", symbol: "$", rate: 1 };
  }
}

async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("pricing_plans_full")
    .select("*");
  if (error) throw error;
  return (data ?? []) as Plan[];
}

// ─── Navigation helper ────────────────────────────────────────────────────────

/**
 * Scroll to #contact and pre-select the service matching the plan name.
 * Contact.tsx's SERVICE_OPTIONS are checked; if the plan name matches one
 * exactly (e.g. "Website Development") it will be pre-selected. Otherwise
 * "Other" remains selected — either way the scroll still happens.
 */
function goToContact(planName: string) {
  const contactEl = document.getElementById("contact");
  if (contactEl) {
    contactEl.scrollIntoView({ behavior: "smooth" });
  }
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("redspark:select-service", { detail: { service: planName } })
    );
  }, 80);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currency, setCurrency] = useState<Currency>({ code: "USD", symbol: "$", rate: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [resolvedCurrency, resolvedPlans] = await Promise.all([
          detectCurrency(),
          fetchPlans(),
        ]);
        if (cancelled) return;
        setCurrency(resolvedCurrency);
        setPlans(resolvedPlans);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load pricing.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Pricing</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Straightforward packages</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Need something custom? Pricing varies — contact us for a tailored quote.
          </p>

          {!loading && currency.code !== "USD" && (
            <p className="mt-2 text-sm text-muted-foreground/70">
              Prices shown in <strong>{currency.code}</strong> based on your location.
              All amounts are starting prices.
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading plans…</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Plan cards */}
        {!loading && !error && (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => {
              const convertedAmount = convertPrice(p.price_usd_cents, currency.rate);
              const displayPrice = formatPrice(convertedAmount, currency);

              return (
                <div
                  key={p.id}
                  className={`relative rounded-2xl border p-8 backdrop-blur transition-all ${
                    p.highlight
                      ? "border-primary/60 bg-(image:--gradient-card) shadow-(--shadow-elegant) md:scale-105"
                      : "border-border/60 bg-card/50"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-(image:--gradient-primary) px-3 py-1 text-xs font-bold text-primary-foreground">
                      Most Popular
                    </span>
                  )}

                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-5xl font-bold font-display">{displayPrice}</span>
                    <span className="text-muted-foreground text-sm">starting</span>
                  </div>

                  {currency.code !== "USD" && (
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      ≈ ${(p.price_usd_cents / 100).toFixed(0)} USD
                    </p>
                  )}

                  <ul className="mt-8 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check className="mt-0.5 h-4 w-4 text-accent shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/*
                   * Deep-link to contact with this plan pre-selected as the service.
                   * Uses a <button> instead of <a href="#contact"> so we can dispatch
                   * the CustomEvent before the scroll completes.
                   */}
                  <button
                    type="button"
                    onClick={() => goToContact(p.name)}
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all group ${
                      p.highlight
                        ? "bg-(image:--gradient-primary) text-primary-foreground hover:opacity-90"
                        : "border border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}