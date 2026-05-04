import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/logo.png";

// ─── Brand SVG icon components ────────────────────────────────────────────────
// Using inline SVG for all social icons so we can support X (the updated Twitter
// brand mark), Facebook, and LinkedIn which are not in lucide-react.

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631ZM17.08 20.25h1.832L7.084 4.126H5.117Z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteSetting = { key: string; value: string };

type SiteInfo = {
  contact_email: string;
  contact_phone: string;        // formatted display e.g. "+264 81 873 6612"
  contact_phone_raw: string;    // digits only for href e.g. "264818736612"
  social_twitter: string;
  social_instagram: string;
  social_github: string;
  social_facebook: string;
  social_linkedin: string;
};

// Fallback defaults — used until Supabase responds and as safe placeholder values
const DEFAULTS: SiteInfo = {
  contact_email:    "redsparkdigital@gmail.com",
  contact_phone:    "+264 81 873 6612",
  contact_phone_raw:"264818736612",
  social_twitter:   "",
  social_instagram: "",
  social_github:    "",
  social_facebook:  "",
  social_linkedin:  "",
};

// ─── Social icon definition list ─────────────────────────────────────────────
// Defines order + label + icon component for each social platform.
// A platform is only rendered in the footer if its URL is non-empty.

type SocialEntry = {
  key: keyof SiteInfo;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const SOCIAL_ICONS: SocialEntry[] = [
  { key: "social_twitter",   label: "X (Twitter)", Icon: IconX },
  { key: "social_instagram", label: "Instagram",   Icon: IconInstagram },
  { key: "social_github",    label: "GitHub",      Icon: IconGitHub },
  { key: "social_facebook",  label: "Facebook",    Icon: IconFacebook },
  { key: "social_linkedin",  label: "LinkedIn",    Icon: IconLinkedIn },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Footer() {
  const [info, setInfo] = useState<SiteInfo>(DEFAULTS);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("key, value")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        (data as SiteSetting[]).forEach((s) => { map[s.key] = s.value; });

        setInfo({
          // For contact fields fall back to DEFAULTS so the footer is never blank
          contact_email:    map["contact_email"]?.trim()    || DEFAULTS.contact_email,
          contact_phone:    map["contact_phone"]?.trim()    || DEFAULTS.contact_phone,
          contact_phone_raw:map["contact_phone_raw"]?.trim()|| DEFAULTS.contact_phone_raw,
          // Social links: empty string = icon hidden (no fallback, intentional)
          social_twitter:   map["social_twitter"]?.trim()   ?? "",
          social_instagram: map["social_instagram"]?.trim() ?? "",
          social_github:    map["social_github"]?.trim()    ?? "",
          social_facebook:  map["social_facebook"]?.trim()  ?? "",
          social_linkedin:  map["social_linkedin"]?.trim()  ?? "",
        });
      });
  }, []);

  // Derive active social entries — only those with a URL filled in
  const activeSocials = SOCIAL_ICONS.filter(({ key }) => info[key].trim() !== "");

  // Build the phone href: prefer the raw digits field, fall back to stripping
  // the display string of non-digit characters
  const phoneHref = `tel:+${info.contact_phone_raw || info.contact_phone.replace(/[^\d]/g, "")}`;

  return (
    <footer className="border-t border-border/60 bg-card/40 py-12">
      <div className="container mx-auto px-4 grid gap-10 md:grid-cols-4">

        {/* ── Brand block ── */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <img src={logo} alt="RedSparkDigital logo" className="h-9 w-9 object-contain" />
            RedSparkDigital
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            Reliable tech solutions for homes &amp; businesses. Websites, PCs, Windows, and software — done right.
          </p>

          {/*
            Social icons — rendered conditionally.
            The entire block is hidden if no social URL is configured.
            Individual icons are only shown when their specific URL is non-empty.
          */}
          {activeSocials.length > 0 && (
            <div className="mt-5 flex gap-3 flex-wrap">
              {activeSocials.map(({ key, label, Icon }) => (
                <a
                  key={key}
                  href={info[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── Services ── */}
        <div>
          <div className="font-semibold mb-3">Services</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#services" className="hover:text-foreground">Website Development</a></li>
            <li><a href="#services" className="hover:text-foreground">PC Setup</a></li>
            <li><a href="#services" className="hover:text-foreground">Windows Install</a></li>
            <li><a href="#services" className="hover:text-foreground">Software Setup</a></li>
          </ul>
        </div>

        {/* ── Contact ── */}
        <div>
          <div className="font-semibold mb-3">Contact</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {info.contact_email && (
              <li>
                <a
                  href={`mailto:${info.contact_email}`}
                  className="hover:text-foreground break-all"
                >
                  {info.contact_email}
                </a>
              </li>
            )}
            {info.contact_phone && (
              <li>
                <a href={phoneHref} className="hover:text-foreground">
                  {info.contact_phone}
                </a>
              </li>
            )}
            <li>
              <a href="#contact" className="hover:text-foreground">Get a Quote</a>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="container mx-auto px-4 mt-10 pt-6 border-t border-border/60 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} RedSparkDigital. All rights reserved.</span>
        <div className="flex gap-5">
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
        </div>
      </div>
    </footer>
  );
}