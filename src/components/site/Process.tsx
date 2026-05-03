import { MessageSquare, Search, Wrench, CheckCircle2 } from "lucide-react";

const steps = [
  { icon: MessageSquare, title: "Contact us", desc: "Tell us what you need or request a free quote." },
  { icon: Search, title: "We assess", desc: "We review your setup and recommend the best plan." },
  { icon: Wrench, title: "We get it done", desc: "Job completed remotely or on-site — efficient and clean." },
  { icon: CheckCircle2, title: "You confirm", desc: "We walk through the result and make sure it's perfect." },
];

export function Process() {
  return (
    <section id="process" className="py-24 md:py-32 bg-card/30 border-y border-border/50 relative">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">How it works</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Simple, transparent process</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-4 relative">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="rounded-2xl border border-border/60 bg-card p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-3xl font-bold text-muted-foreground/40">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
