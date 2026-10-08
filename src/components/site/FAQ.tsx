import { Plus } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { useSiteInfo } from "../../lib/site";

function buildFaqs(location: string) {
  return [
    {
      q: "Do you offer on-site or remote support?",
      a: `Both. We come to you in and around ${location} for on-site work, and offer remote support nationwide and across Southern Africa for most software, setup and troubleshooting jobs.`,
    },
    {
      q: "Will I lose my files when you reinstall Windows?",
      a: "No. We back up your data before every Windows install or upgrade and restore it once your system is set up, so your documents and photos stay safe.",
    },
    {
      q: "How much does a website or PC setup cost?",
      a: "Our packages show clear starting prices in your local currency. Every job is a little different, so we confirm the final price after a quick chat about what you need — no surprises.",
    },
    {
      q: "Can I combine several services into one package?",
      a: "Yes. Choose “Custom package” in the contact form, tell us what you need — for example a website plus PC setup for your office — and we'll put together a quote.",
    },
    {
      q: "How quickly will you get back to me?",
      a: "Usually within a few hours. WhatsApp is the fastest way to reach us, or send the contact form and we'll reply by email or phone.",
    },
    {
      q: "What software can you install?",
      a: "Microsoft Office (Word, Excel, PowerPoint and more) and the everyday tools you rely on — installed, set up and ready to use. We can also troubleshoot programs that aren't working properly.",
    },
  ];
}

export function FAQ() {
  const site = useSiteInfo();
  const faqs = buildFaqs(site.business_location);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <section id="faq" aria-labelledby="faq-title" className="py-24 md:py-32">
      <div className="container mx-auto grid gap-10 px-4 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeader
          id="faq-title"
          eyebrow="FAQ"
          title="Questions, answered"
          description={
            <>
              Can't find what you're looking for?{" "}
              <a href="#contact" className="font-semibold text-primary hover:text-primary-glow">
                Ask us directly
              </a>
              .
            </>
          }
        />

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="group rounded-2xl border border-border/60 bg-card/50 transition-colors open:border-primary/40 open:bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 transition-transform duration-200 group-open:rotate-45 group-open:border-primary/50 group-open:text-primary">
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
