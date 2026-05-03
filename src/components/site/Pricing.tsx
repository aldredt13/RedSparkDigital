import { Check } from "lucide-react";

const plans = [
  {
    name: "Basic PC Setup",
    price: "$49",
    desc: "Perfect for a quick tune-up.",
    features: ["Driver installation", "System cleanup", "Performance tuning", "Basic software setup"],
  },
  {
    name: "Website Starter",
    price: "$299",
    desc: "Get online with a polished site.",
    features: ["Up to 5 pages", "Mobile responsive", "Contact form", "Basic SEO setup"],
    highlight: true,
  },
  {
    name: "Full System Install",
    price: "$129",
    desc: "Fresh Windows + everything ready.",
    features: ["Windows 10/11 install", "Data backup", "Office + essential software", "Full optimization"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Pricing</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Straightforward packages</h2>
          <p className="mt-4 text-muted-foreground text-lg">Need something custom? Pricing varies — contact us for a tailored quote.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
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
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold font-display">{p.price}</span>
                <span className="text-muted-foreground text-sm">starting</span>
              </div>
              <ul className="mt-8 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 text-accent shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-all ${
                  p.highlight
                    ? "bg-(image:--gradient-primary) text-primary-foreground hover:opacity-90"
                    : "border border-border bg-card hover:bg-secondary"
                }`}
              >
                Get Started
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}