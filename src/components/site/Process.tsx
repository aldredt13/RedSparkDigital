import { MessageSquare, Search, Wrench, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const steps = [
  { icon: MessageSquare, title: "Contact us", desc: "Tell us what you need or request a free quote — by form, email or WhatsApp." },
  { icon: Search, title: "We assess", desc: "We review your setup and recommend the best plan for your needs and budget." },
  { icon: Wrench, title: "We get it done", desc: "The job is completed remotely or on-site — efficient and clean." },
  { icon: CheckCircle2, title: "You confirm", desc: "We walk you through the result and make sure it's exactly right." },
];

export function Process() {
  return (
    <section id="process" aria-labelledby="process-title" className="relative border-y border-border/50 bg-card/30 py-24 md:py-32">
      <div className="container mx-auto px-4">
        <SectionHeader id="process-title" eyebrow="How it works" title="Simple, transparent process" />

        <ol className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Connector line on large screens */}
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[2.85rem] hidden h-px bg-linear-to-r from-primary/0 via-primary/40 to-primary/0 lg:block" aria-hidden />

          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="h-full rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40">
                <div className="mb-5 flex items-center justify-between">
                  <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-4 ring-card">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-4xl font-bold text-muted-foreground/25">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
