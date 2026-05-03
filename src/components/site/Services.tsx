import { Code2, Cpu, MonitorCog, Package } from "lucide-react";

const services = [
  {
    icon: Code2,
    title: "Website Development",
    desc: "Modern, fast, and conversion-ready sites built to grow your business.",
    items: ["Business websites", "Landing pages", "Custom dashboards"],
  },
  {
    icon: Cpu,
    title: "PC Setup & Optimization",
    desc: "Make any PC run like new with proper drivers, cleanup and tuning.",
    items: ["Driver installation", "System cleanup", "Performance tuning"],
  },
  {
    icon: MonitorCog,
    title: "Windows Installation",
    desc: "Clean, secure, and fully configured Windows installs with your data safe.",
    items: ["Windows 10 / 11 fresh installs", "System upgrades", "Data backup before install"],
  },
  {
    icon: Package,
    title: "Software Installation",
    desc: "All the tools you need, properly installed, activated, and ready to use.",
    items: ["Microsoft Office (Word, Excel…)", "General software setup", "Troubleshooting"],
  },
];

export function Services() {
  return (
    <section id="services" className="py-24 md:py-32 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">What we do</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Services tailored to keep you running</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            From a brand-new website to a freshly installed Windows machine — we handle the tech, you focus on the work.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <article
              key={s.title}
              className="group relative rounded-2xl border border-border/60 bg-(image:--gradient-card) p-6 backdrop-blur shadow-(--shadow-card) hover:border-primary/50 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-(image:--gradient-primary) shadow-(--shadow-glow)">
                <s.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {s.items.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-foreground/90">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className="mt-6 inline-flex text-sm font-semibold text-primary hover:text-primary-glow transition-colors"
              >
                Request Service →
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}