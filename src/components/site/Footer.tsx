import { Github, Instagram, Twitter, } from "lucide-react";
import logo from "../../assets/logo.png";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40 py-12">
      <div className="container mx-auto px-4 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-display font-bold text-lg">
            <img src={logo} alt="RedSparkDigital logo" className="h-9 w-9 object-contain" />
            RedSparkDigital
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            Reliable tech solutions for homes & businesses. Websites, PCs, Windows, and software — done right.
          </p>
          <div className="mt-5 flex gap-3">
            {[Twitter, Instagram, Github].map((Icon, i) => (
              <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/50 hover:bg-secondary transition-colors">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="font-semibold mb-3">Services</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#services" className="hover:text-foreground">Website Development</a></li>
            <li><a href="#services" className="hover:text-foreground">PC Setup</a></li>
            <li><a href="#services" className="hover:text-foreground">Windows Install</a></li>
            <li><a href="#services" className="hover:text-foreground">Software Setup</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Contact</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>redsparkdigital@gmail.com</li>
            <li>+264 81 873 6612</li>
            <li><a href="#contact" className="hover:text-foreground">Get a Quote</a></li>
          </ul>
        </div>
      </div>
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
