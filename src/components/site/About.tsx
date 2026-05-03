import { Award, Clock, Users } from "lucide-react";

const stats = [
  { icon: Users, value: "120+", label: "Happy clients" },
  { icon: Clock, value: "24h", label: "Avg. response time" },
  { icon: Award, value: "5+ yrs", label: "Experience" },
];

export function About() {
  return (
    <section id="about" className="py-24 md:py-32 bg-card/30 border-y border-border/50">
      <div className="container mx-auto px-4 grid gap-12 md:grid-cols-2 items-center">
        <div>
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">About</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Tech you can actually trust.</h2>
          <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
            We're a small team obsessed with making technology work — properly. Whether it's a brand-new website,
            a sluggish laptop, or a Windows install gone wrong, we treat every job like it's our own setup.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            No jargon, no upselling. Just clean work, fair prices, and people who pick up the phone.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-6 text-center">
              <s.icon className="mx-auto h-6 w-6 text-accent" />
              <div className="mt-3 font-display text-3xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
