import { Award, Clock, HeartHandshake, MapPin, Users } from "lucide-react";
import { useSiteInfo } from "../../lib/site";

const stats = [
  { icon: Users, value: "120+", label: "Happy clients" },
  { icon: Clock, value: "24h", label: "Avg. response time" },
  { icon: Award, value: "5+ yrs", label: "Experience" },
];

const values = [
  { icon: HeartHandshake, title: "No jargon, no upselling", desc: "Just clean work, fair prices, and people who pick up the phone." },
  { icon: MapPin, title: "Local and remote", desc: "On-site visits locally, remote support wherever you are." },
];

export function About() {
  const site = useSiteInfo();
  return (
    <section id="about" aria-labelledby="about-title" className="border-y border-border/50 bg-card/30 py-24 md:py-32">
      <div className="container mx-auto grid items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="eyebrow">About</span>
          <h2 id="about-title" className="mt-4 text-3xl font-bold leading-[1.1] sm:text-4xl md:text-5xl">
            Tech you can actually trust.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            We're a small team in {site.business_location} obsessed with making technology work — properly. Whether it's a brand-new
            website, a sluggish laptop, or a Windows install gone wrong, we treat every job like it's our own setup.
          </p>
          <ul className="mt-8 space-y-4">
            {values.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-6 sm:flex-col sm:text-center lg:flex-row lg:text-left xl:flex-col xl:text-center"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <s.icon className="h-6 w-6" />
              </span>
              <div>
                <div className="font-display text-3xl font-bold">{s.value}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
