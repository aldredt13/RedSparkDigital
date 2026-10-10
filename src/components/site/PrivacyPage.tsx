import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, ShieldCheck } from "lucide-react";
import logo from "../../assets/logo-128.webp";
import { setAnalyticsOptOut, trackingStatus, type TrackingStatus } from "../../lib/analytics";
import { useSiteInfo, whatsappLink } from "../../lib/site";

const PRIVACY_LAST_UPDATED = "10 October 2026";

const SECTIONS = [
  ["who-we-are", "Who we are"],
  ["what-you-give-us", "Information you give us"],
  ["collected-automatically", "Information collected automatically"],
  ["how-we-use", "How we use your information"],
  ["sharing", "Who we share it with"],
  ["browser-storage", "Storage in your browser"],
  ["retention", "How long we keep it"],
  ["transfers", "Where it's stored"],
  ["security", "Security"],
  ["your-rights", "Your choices and rights"],
  ["children", "Children"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact us"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/50 pt-8">
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 pl-1 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-accent">{children}</ul>;
}

/** Lets visitors see and change whether their visits are counted (client-side only). */
function AnalyticsChoice() {
  const [state, setState] = useState<{ status: TrackingStatus; visitorId: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setState(trackingStatus()), []);

  function toggle(optOut: boolean) {
    setAnalyticsOptOut(optOut);
    setState(trackingStatus());
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5" aria-live="polite">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <ShieldCheck className="h-5 w-5 text-accent" /> Your analytics choice
      </p>
      {!state ? (
        <p className="mt-2 text-sm">Checking this browser…</p>
      ) : state.status === "browser-signal" ? (
        <p className="mt-2 text-sm">
          Your browser is sending a <strong>Do Not Track</strong> or <strong>Global Privacy Control</strong> signal, so we don't record your visits.
        </p>
      ) : state.status === "opted-out" ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>You've opted out — we don't record visits from this browser.</p>
          <button type="button" onClick={() => toggle(false)} className="rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-secondary">
            Opt back in
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Visits from this browser are counted in our anonymous statistics.</p>
            <button type="button" onClick={() => toggle(true)} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-glow">
              Opt out
            </button>
          </div>
          {state.visitorId && (
            <p className="flex flex-wrap items-center gap-2 text-xs">
              Your analytics ID (include it if you ask us to delete your data):
              <button
                type="button"
                onClick={() => copyId(state.visitorId!)}
                className="inline-flex items-center gap-1.5 rounded bg-secondary px-2 py-1 font-mono text-foreground hover:bg-secondary/70"
                title="Copy"
              >
                {state.visitorId}
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PrivacyPage() {
  const site = useSiteInfo();

  useEffect(() => {
    document.title = "Privacy Policy | RedSpark Digital";
  }, []);

  const email = site.contact_email;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2.5 font-display text-lg font-bold">
            <img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
            <span>
              RedSpark<span className="text-primary">Digital</span>
            </span>
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-3.5 py-2 text-sm font-medium hover:bg-card">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </a>
        </div>
      </header>

      <main id="main" className="container mx-auto px-4 py-14 md:py-20">
        <div className="max-w-3xl">
          <span className="eyebrow">Legal</span>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Privacy policy</h1>
          <p className="mt-4 text-muted-foreground">Last updated {PRIVACY_LAST_UPDATED}</p>

          <div className="mt-8 rounded-2xl border border-border/60 bg-card/50 p-6">
            <p className="font-semibold">The short version</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {[
                "We only collect what we need to reply to you and to understand how our website is used.",
                "We don't sell your information, show ads, or use third-party advertising trackers.",
                "Our visit statistics are first-party and use no cookies. You can opt out below, and we respect Do Not Track and Global Privacy Control.",
                "You can ask us to see, correct or delete your information at any time.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[230px_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">On this page</p>
              <ol className="space-y-1.5 text-sm">
                {SECTIONS.map(([id, title]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-muted-foreground transition-colors hover:text-foreground">
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="max-w-3xl space-y-10">
            <Section id="who-we-are" title="Who we are">
              <p>
                RedSpark Digital provides website development, PC setup, Windows installation and software support, based in {site.business_location}.
                This policy explains what personal information we collect through this website, why, and the choices you have. When we say “we” or “us”,
                we mean RedSpark Digital.
              </p>
            </Section>

            <Section id="what-you-give-us" title="Information you give us">
              <p>
                When you send us a message using the <strong>contact form</strong>, we collect:
              </p>
              <List>
                <li>your name and email address;</li>
                <li>your phone or WhatsApp number, if you choose to give it;</li>
                <li>the service or package you're interested in; and</li>
                <li>your message.</li>
              </List>
              <p>
                If you contact us directly by <strong>WhatsApp, phone or email</strong>, we receive whatever you send us that way, such as your number,
                email address and the content of your messages. WhatsApp is run by Meta, and its own privacy policy applies to messages sent through it.
              </p>
            </Section>

            <Section id="collected-automatically" title="Information collected automatically">
              <p>
                To understand how the site is used and improve it, we record anonymous <strong>visit statistics</strong> in our own database. Unless you've
                opted out, this includes:
              </p>
              <List>
                <li>a random visitor ID created by your browser (it isn't linked to your name unless you also contact us);</li>
                <li>the pages and sections you view, how long you're active on the site, and how far you scroll;</li>
                <li>clicks on our WhatsApp, phone and email links, service and package buttons, FAQ questions and portfolio projects, and whether you sent the contact form;</li>
                <li>the website or campaign link that brought you here;</li>
                <li>your device type, browser, operating system, screen size, language and time zone; and</li>
                <li>your <strong>IP address</strong>, the approximate location it suggests (country, region and city), and the name of your internet provider — which we use to filter out automated traffic from cloud servers.</li>
              </List>
              <p>
                We don't record visits from browsers that send a Do Not Track or Global Privacy Control signal, or from known bots.
              </p>
              <p>
                To show prices in <strong>your local currency</strong>, your browser asks a location service for your approximate location based on your IP
                address, and fetches current exchange rates. Our hosting provider also keeps standard technical logs (such as IP addresses) to run and secure
                the site.
              </p>
            </Section>

            <Section id="how-we-use" title="How we use your information">
              <List>
                <li>to reply to your enquiry, prepare quotes and provide the services you ask for;</li>
                <li>to notify our team instantly when a new enquiry arrives;</li>
                <li>to understand which pages, services and channels are useful, so we can improve the site and our offering;</li>
                <li>to show prices in your local currency; and</li>
                <li>to keep the website secure and prevent spam and abuse.</li>
              </List>
              <p>We don't use your information for automated decisions about you, and we don't send marketing messages unless you ask us to.</p>
            </Section>

            <Section id="sharing" title="Who we share it with">
              <p>
                We <strong>don't sell</strong> your personal information or share it with advertisers. We use a small number of service providers to run the
                site, who only process it to provide their service to us:
              </p>
              <List>
                <li>
                  <strong>Supabase</strong> — stores contact form messages and visit statistics.
                </li>
                <li>
                  <strong>Vercel</strong> — hosts the website.
                </li>
                <li>
                  <strong>Discord</strong> — we receive a notification with the details of each contact form enquiry in a private Discord channel.
                </li>
                <li>
                  <strong>GeoJS</strong> (with Country.is and Cloudflare as backups) and <strong>ExchangeRate-API</strong> — provide approximate location,
                  internet-provider name and exchange rates for local-currency prices and visit statistics.
                </li>
              </List>
              <p>We may also disclose information if the law requires it, or to protect our rights or the safety of others.</p>
            </Section>

            <Section id="browser-storage" title="Storage in your browser">
              <p>
                This site <strong>doesn't use cookies</strong>. It saves a few small items in your browser's local storage, which stay on your device:
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-sm">
                  <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Item</th>
                      <th className="px-4 py-2.5 font-semibold">Purpose</th>
                      <th className="px-4 py-2.5 font-semibold">Kept for</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[
                      ["Visitor ID (rsd:vid)", "Recognises return visits in our statistics", "Until you clear it or opt out"],
                      ["Visit session (rsd:session)", "Groups the pages you view in one visit", "30 minutes after your last activity"],
                      ["Location & currency (rsd:currency)", "Remembers your currency so prices load quickly", "12 hours"],
                      ["Currency choice (rsd:currency-pref)", "Remembers if you switched to US dollars", "Until you clear it"],
                      ["Opt-out (rsd:analytics-exclude)", "Remembers that you opted out of statistics", "Until you clear it"],
                    ].map(([item, purpose, kept]) => (
                      <tr key={item}>
                        <td className="px-4 py-2.5 font-medium text-foreground">{item}</td>
                        <td className="px-4 py-2.5">{purpose}</td>
                        <td className="px-4 py-2.5">{kept}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>You can delete these at any time by clearing your browser's site data.</p>
            </Section>

            <Section id="retention" title="How long we keep it">
              <List>
                <li>
                  <strong>Enquiries</strong> are kept for as long as we need them to respond to you and provide our services, and deleted when you ask us to.
                </li>
                <li>
                  <strong>IP addresses</strong> in our visit statistics are deleted automatically after <strong>90 days</strong>.
                </li>
                <li>
                  <strong>Other visit statistics</strong> are deleted automatically after <strong>13 months</strong>.
                </li>
                <li>Enquiry notifications in our private Discord channel are deleted when no longer needed.</li>
              </List>
            </Section>

            <Section id="transfers" title="Where it's stored">
              <p>
                Our service providers may store and process information on servers outside Namibia. When that happens, we rely on providers that protect data
                with industry-standard security measures.
              </p>
            </Section>

            <Section id="security" title="Security">
              <p>
                The site is served over an encrypted connection (HTTPS). Enquiries and visit statistics can only be read by our team through a password-protected
                admin area, and access to the database is restricted. No method of storing or sending information online is completely secure, but we work to
                protect your information and only keep what we need.
              </p>
            </Section>

            <Section id="your-rights" title="Your choices and rights">
              <p>You can ask us to:</p>
              <List>
                <li>tell you what personal information we hold about you and give you a copy;</li>
                <li>correct information that's wrong or out of date;</li>
                <li>delete your information, including your enquiries and visit statistics; or</li>
                <li>stop using your information for a particular purpose.</li>
              </List>
              <p>
                Email us at{" "}
                <a href={`mailto:${email}`} className="font-semibold text-primary hover:text-primary-glow">
                  {email}
                </a>{" "}
                and we'll respond within 30 days. To delete your visit statistics, please include the analytics ID shown below.
              </p>
              <AnalyticsChoice />
            </Section>

            <Section id="children" title="Children">
              <p>
                This website is meant for adults and businesses. We don't knowingly collect information from children. If you think a child has sent us their
                details, contact us and we'll delete them.
              </p>
            </Section>

            <Section id="changes" title="Changes to this policy">
              <p>
                We'll update this page if we change how we handle personal information, and change the “last updated” date at the top. If the changes are
                significant, we'll make that clear on the site.
              </p>
            </Section>

            <Section id="contact" title="Contact us">
              <p>Questions about this policy or your information? Get in touch:</p>
              <List>
                <li>
                  Email:{" "}
                  <a href={`mailto:${email}`} className="font-semibold text-primary hover:text-primary-glow">
                    {email}
                  </a>
                </li>
                {site.contact_phone && (
                  <li>
                    Phone: <span className="text-foreground">{site.contact_phone}</span>
                  </li>
                )}
                {site.contact_phone_raw && (
                  <li>
                    WhatsApp:{" "}
                    <a href={whatsappLink(site.contact_phone_raw)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:text-primary-glow">
                      chat with us
                    </a>
                  </li>
                )}
                <li>
                  Location: <span className="text-foreground">{site.business_location}</span>
                </li>
              </List>
            </Section>
          </article>
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} RedSpark Digital. All rights reserved.</span>
          <span className="flex gap-5">
            <a href="/" className="hover:text-foreground">
              Home
            </a>
            <a href="/#contact" className="hover:text-foreground">
              Contact
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
