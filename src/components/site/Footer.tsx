import { ArrowUp, Mail, MapPin, Phone } from "lucide-react";
import logo from "../../assets/logo.png";
import { requestService, SERVICE_OPTIONS, telLink, useSiteInfo, whatsappLink } from "../../lib/site";
import { IconWhatsApp, SOCIAL_LINKS } from "./icons";

const quickLinks = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#portfolio", label: "Recent work" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Get a quote" },
];

export function Footer() {
  const info = useSiteInfo();
  const socials = SOCIAL_LINKS.filter(({ key }) => info[key].trim() !== "");
  const phoneHref = telLink(info.contact_phone, info.contact_phone_raw);

  return (
    <footer data-where="footer" className="border-t border-border/60 bg-card/40">
      <div className="container mx-auto grid gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        {/* Brand */}
        <div>
          <a href="#top" className="flex items-center gap-2.5 font-display text-lg font-bold">
            <img src={logo} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 object-contain" />
            <span>
              RedSpark<span className="text-primary">Digital</span>
            </span>
          </a>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Reliable tech solutions for homes &amp; businesses. Websites, PCs, Windows and software — done right.
          </p>
          {socials.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map(({ key, label, Icon }) => (
                <a
                  key={key}
                  href={info[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Services */}
        <nav aria-label="Services">
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-normal">Services</h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {SERVICE_OPTIONS.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => requestService(s)} className="text-left transition-colors hover:text-foreground">
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Quick links */}
        <nav aria-label="Footer">
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-normal">Explore</h2>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {quickLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="transition-colors hover:text-foreground">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h2 className="mb-4 font-sans text-sm font-semibold tracking-normal">Contact</h2>
          <address className="space-y-3 text-sm not-italic text-muted-foreground">
            {info.contact_email && (
              <a href={`mailto:${info.contact_email}`} className="flex items-center gap-2.5 break-all transition-colors hover:text-foreground">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                {info.contact_email}
              </a>
            )}
            {info.contact_phone && (
              <a href={phoneHref} className="flex items-center gap-2.5 transition-colors hover:text-foreground">
                <Phone className="h-4 w-4 shrink-0 text-accent" />
                {info.contact_phone}
              </a>
            )}
            {info.contact_phone_raw && (
              <a
                href={whatsappLink(info.contact_phone_raw)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 transition-colors hover:text-foreground"
              >
                <IconWhatsApp className="h-4 w-4 shrink-0 text-emerald-400" />
                WhatsApp
              </a>
            )}
            <p className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-accent" />
              {info.business_location}
            </p>
          </address>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} RedSpark Digital. All rights reserved.</span>
          <a href="#top" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            Back to top <ArrowUp className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
