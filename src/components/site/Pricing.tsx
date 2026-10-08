import { AlertCircle, ArrowRight, Check, MapPin, Sparkles } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { formatPrice, formatUsd, useCurrency } from "../../lib/currency";
import { CUSTOM_PACKAGE, packageValue, requestService, usePlans } from "../../lib/site";
import { track } from "../../lib/analytics";

export function Pricing() {
  const { plans, loading, error } = usePlans();
  const { currency, local, ready, preference, setPreference } = useCurrency();
  const showToggle = ready && local.code !== "USD";

  const gridCols =
    plans.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2 max-w-4xl mx-auto" : "max-w-md mx-auto";

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-1/3 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-primary/10 blur-[140px]" aria-hidden />

      <div className="container mx-auto px-4">
        <SectionHeader
          id="pricing-title"
          eyebrow="Pricing"
          title="Straightforward packages"
          description="Clear starting prices for the most common jobs. Need something different? We'll build a custom package around you."
        >
          {showToggle && (
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <div className="inline-flex rounded-lg border border-border/60 bg-card/60 p-1" role="group" aria-label="Currency">
                {(["local", "USD"] as const).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => {
                      setPreference(pref);
                      track("currency_toggle", { currency: pref === "local" ? local.code : "USD" });
                    }}
                    aria-pressed={preference === pref}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      preference === pref ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {pref === "local" ? local.code : "USD"}
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {preference === "local" ? `Shown in ${local.code} based on your location` : "Shown in US dollars"}
              </span>
            </div>
          )}
        </SectionHeader>

        {error && !loading && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>We couldn't load our packages right now — get in touch and we'll send you a quote.</span>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-2xl border border-border/60 bg-card/40" />
            ))}
          </div>
        ) : (
          plans.length > 0 && (
            <div className={`grid items-stretch gap-6 ${gridCols}`}>
              {plans.map((p) => (
                <article
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border p-7 md:p-8 backdrop-blur transition-all duration-300 ${
                    p.highlight
                      ? "border-primary/60 bg-(image:--gradient-card) shadow-(--shadow-elegant) ring-1 ring-primary/30 lg:-translate-y-3"
                      : "border-border/60 bg-card/50 hover:border-border"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-(image:--gradient-primary) px-3 py-1 text-xs font-bold text-primary-foreground shadow-(--shadow-glow)">
                      <Sparkles className="h-3 w-3" /> Most popular
                    </span>
                  )}

                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}

                  <div className="mt-6">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">From</span>
                    <div className="mt-1 flex items-baseline gap-2">
                      {ready ? (
                        <span className="font-display text-4xl md:text-5xl font-bold tracking-tight">{formatPrice(p.price_usd_cents, currency)}</span>
                      ) : (
                        <span className="inline-block h-12 w-36 animate-pulse rounded-lg bg-muted" aria-label="Loading price" />
                      )}
                    </div>
                    {ready && currency.code !== "USD" && (
                      <p className="mt-1.5 text-xs text-muted-foreground/70">≈ {formatUsd(p.price_usd_cents)} USD</p>
                    )}
                  </div>

                  <ul className="mt-7 flex-1 space-y-3 border-t border-border/50 pt-6">
                    {p.features.map((f, i) => (
                      <li key={`${i}-${f}`} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-accent/15">
                          <Check className="h-3 w-3 text-accent" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => requestService(packageValue(p.name))}
                    className={`group mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                      p.highlight
                        ? "bg-(image:--gradient-primary) text-primary-foreground hover:opacity-90"
                        : "border border-border bg-card hover:border-primary/50 hover:bg-secondary"
                    }`}
                  >
                    Choose {p.name}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </article>
              ))}
            </div>
          )
        )}

        {/* Custom package */}
        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 md:flex-row md:items-center md:p-8">
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold">Need a custom package?</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Mix and match services — say a new website plus PC setup for your office — and we'll put together a package and quote
              that fits. Final prices are confirmed after a quick assessment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestService(CUSTOM_PACKAGE)}
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Build a custom package
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
}
