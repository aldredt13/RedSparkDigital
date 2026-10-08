import { Code2, Cpu, MonitorCog, Package, ArrowRight, Check } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { requestService, SERVICE_OPTIONS } from "../../lib/site";

const services = [
  {
    icon: Code2,
    service: SERVICE_OPTIONS[0],
    desc: "Modern, fast and conversion-ready websites built to grow your business.",
    items: ["Business websites", "Landing pages", "Custom dashboards"],
    tint: "from-sky-500/25 via-sky-500/5",
    iconClass: "bg-sky-500/15 text-sky-300 ring-sky-400/20",
  },
  {
    icon: Cpu,
    service: SERVICE_OPTIONS[1],
    desc: "Make any PC run like new with the right drivers, a proper cleanup and tuning.",
    items: ["Driver installation", "System cleanup", "Performance tuning"],
    tint: "from-emerald-500/25 via-emerald-500/5",
    iconClass: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  },
  {
    icon: MonitorCog,
    service: SERVICE_OPTIONS[2],
    desc: "Clean, secure and fully configured Windows installs — with your data kept safe.",
    items: ["Windows 10 / 11 fresh installs", "System upgrades", "Data backup before install"],
    tint: "from-violet-500/25 via-violet-500/5",
    iconClass: "bg-violet-500/15 text-violet-300 ring-violet-400/20",
  },
  {
    icon: Package,
    service: SERVICE_OPTIONS[3],
    desc: "All the tools you need, properly installed, activated and ready to use.",
    items: ["Microsoft Office (Word, Excel…)", "General software setup", "Troubleshooting"],
    tint: "from-amber-500/25 via-amber-500/5",
    iconClass: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
  },
];

export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="relative py-24 md:py-32">
      <div className="container mx-auto px-4">
        <SectionHeader
          id="services-title"
          eyebrow="What we do"
          title="Services tailored to keep you running"
          description="From a brand-new website to a freshly installed Windows machine — we handle the tech, you focus on the work."
        />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((s) => (
            <article
              key={s.service}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-(image:--gradient-card) p-6 shadow-(--shadow-card) backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b ${s.tint} to-transparent opacity-50 transition-opacity duration-300 group-hover:opacity-100`} aria-hidden />

              <div className={`relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${s.iconClass}`}>
                <s.icon className="h-6 w-6" />
              </div>

              <h3 className="relative text-xl font-semibold">{s.service}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>

              <ul className="relative mt-5 flex-1 space-y-2.5 text-sm">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => requestService(s.service)}
                className="relative mt-6 inline-flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/40 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-primary/10"
              >
                Request this service
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
