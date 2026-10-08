import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import logo from "../../assets/logo.png";

const links = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#portfolio", label: "Work" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  // Solid background once the page scrolls
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the section currently in view
  useEffect(() => {
    const sections = links
      .map((l) => document.querySelector<HTMLElement>(l.href))
      .filter((el): el is HTMLElement => !!el);
    // Track which sections cross a thin band in the middle of the viewport
    const inView = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => inView.set(`#${e.target.id}`, e.isIntersecting));
        setActive(links.find((l) => inView.get(l.href))?.href ?? "");
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Lock page scroll + close on Escape while the mobile menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled || open
          ? "bg-background/85 backdrop-blur-xl border-b border-border/60 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.5)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="container mx-auto flex h-16 items-center justify-between gap-4 px-4" aria-label="Main">
        <a href="#top" className="flex items-center gap-2.5 font-display text-lg font-bold" onClick={() => setOpen(false)}>
          <img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
          <span>
            RedSpark<span className="text-primary">Digital</span>
          </span>
        </a>

        <ul className="hidden lg:flex items-center gap-1 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                aria-current={active === l.href ? "true" : undefined}
                className={`rounded-md px-3 py-2 transition-colors ${
                  active === l.href ? "text-foreground bg-card/60" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href="#contact"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-(image:--gradient-primary) px-4 py-2 text-sm font-semibold text-primary-foreground shadow-(--shadow-glow) hover:opacity-90 transition-opacity"
          >
            Get a Quote
          </a>
          <button
            type="button"
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-card/50 text-foreground"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="lg:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl animate-fade-in h-[calc(100svh-4rem)] overflow-y-auto">
          <ul className="container mx-auto px-4 py-4 space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${
                    active === l.href ? "bg-card text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  }`}
                >
                  {l.label}
                  <ArrowRight className="h-4 w-4 opacity-40" />
                </a>
              </li>
            ))}
          </ul>
          <div className="container mx-auto px-4 pb-8">
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-(image:--gradient-primary) px-5 py-3.5 text-base font-semibold text-primary-foreground"
            >
              Get a Quote <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
