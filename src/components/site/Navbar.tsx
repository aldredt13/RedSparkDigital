import logo from "../../assets/logo.png";

const links = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href="#" className="flex items-center gap-2 font-display font-bold text-lg">
          <img src={logo} alt="RedSparkDigital logo" className="h-9 w-9 object-contain" />
          RedSparkDigital
        </a>
        <ul className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
            </li>
          ))}
        </ul>
        <a
          href="#contact"
          className="inline-flex items-center rounded-md bg-(image:--gradient-primary) px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Get a Quote
        </a>
      </nav>
    </header>
  );
}