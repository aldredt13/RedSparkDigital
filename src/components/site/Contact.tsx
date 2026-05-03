import { Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";

export function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <section id="contact" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-96 w-150 rounded-full bg-primary/20 blur-[140px]" />
      <div className="container mx-auto px-4 relative">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Contact</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Let's get your tech sorted</h2>
          <p className="mt-4 text-muted-foreground text-lg">Tell us what you need — we usually reply within hours.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-5 max-w-5xl mx-auto">
          <div className="md:col-span-2 space-y-3">
            <a href="https://wa.me/264818736612" className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/50 transition-colors">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">WhatsApp</div>
                <div className="font-semibold">Chat with us</div>
              </div>
            </a>
            <a href="mailto:redsparkdigital@gmail.com" className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/50 transition-colors">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="font-semibold">redsparkdigital@gmail.com</div>
              </div>
            </a>
            <a href="tel:+264818736612" className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/50 transition-colors">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Phone className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="font-semibold">+264 81 873 6612</div>
              </div>
            </a>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); setSent(true); }}
            className="md:col-span-3 rounded-2xl border border-border/60 bg-(image:--gradient-card) backdrop-blur p-6 md:p-8 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Name</label>
                <input required maxLength={100} className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="John Doe" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <input required type="email" maxLength={255} className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="you@email.com" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Service</label>
              <select className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option>Website Development</option>
                <option>PC Setup & Optimization</option>
                <option>Windows Installation</option>
                <option>Software Installation</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Message</label>
              <textarea required maxLength={1000} rows={4} className="mt-1.5 w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Tell us what you need..." />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-lg bg-(image:--gradient-primary) px-5 py-3 text-sm font-semibold text-primary-foreground shadow-(--shadow-elegant) hover:opacity-90 transition-opacity"
            >
              {sent ? "Message sent ✓" : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}