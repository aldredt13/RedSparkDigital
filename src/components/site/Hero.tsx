import heroImg from "../../assets/hero-tech.jpg";
import { ArrowRight, Code2, Cpu, MapPin, MonitorCog, Package, ShieldCheck, Timer, Wrench } from "lucide-react";
import { useEffect, useRef } from "react";
import { IconWhatsApp } from "./icons";
import { useSiteInfo, whatsappLink } from "../../lib/site";

// ─── Particles ────────────────────────────────────────────────────────────────

const PARTICLE_RGB = "239,68,68"; // red-500
const LINE_RGB = "252,165,165"; // red-300
const MAX_DISTANCE = 140;
const GRAB_DISTANCE = 140;
const PARTICLE_SPEED = 0.6;

interface Point { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

function createParticle(w: number, h: number): Point {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * PARTICLE_SPEED,
    vy: (Math.random() - 0.5) * PARTICLE_SPEED,
    r: Math.random() * 2 + 0.8,
    opacity: Math.random() * 0.5 + 0.2,
  };
}

function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let particles: Point[] = [];
    let mouse: { x: number; y: number } | null = null;
    let raf = 0;
    let visible = true;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Scale particle count with area so phones aren't overloaded
      const count = Math.round(Math.min(80, Math.max(28, (width * height) / 16000)));
      particles = Array.from({ length: count }, () => createParticle(width, height));
      if (reduceMotion) draw(false);
    };

    const draw = (animate = true) => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (animate) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -p.r) p.x = width + p.r;
          if (p.x > width + p.r) p.x = -p.r;
          if (p.y < -p.r) p.y = height + p.r;
          if (p.y > height + p.r) p.y = -p.r;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_RGB},${p.opacity})`;
        ctx.fill();
      }

      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= MAX_DISTANCE * MAX_DISTANCE) {
            ctx.strokeStyle = `rgba(${LINE_RGB},${0.22 * (1 - Math.sqrt(d2) / MAX_DISTANCE)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (mouse) {
        for (const p of particles) {
          const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (d <= GRAB_DISTANCE) {
            ctx.strokeStyle = `rgba(${LINE_RGB},${0.5 * (1 - d / GRAB_DISTANCE)})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (!reduceMotion && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    // The canvas sits under the hero content, so track the pointer on the window
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouse = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      play();
    });

    resize();
    play();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", play);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", play);
    };
  }, [canvasRef]);
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const trust = [
  { icon: MapPin, label: "On-site & remote" },
  { icon: ShieldCheck, label: "Data backed up first" },
  { icon: Timer, label: "Replies within hours" },
];

const quickServices = [
  { icon: Code2, title: "Website development", meta: "Business sites & landing pages" },
  { icon: Cpu, title: "PC setup & tune-up", meta: "Drivers, cleanup, performance" },
  { icon: MonitorCog, title: "Windows installation", meta: "Fresh installs & upgrades" },
  { icon: Package, title: "Software installation", meta: "Office & everyday tools" },
];

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const site = useSiteInfo();
  useParticles(canvasRef);

  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate flex min-h-svh items-center overflow-hidden pt-24 pb-16 md:pt-28">
      {/* Background */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        <img src={heroImg} alt="" width={1920} height={1080} fetchPriority="high" className="h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-(image:--gradient-hero) opacity-85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.6_0.22_25/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/20 to-background" />
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 -z-10 h-full w-full" aria-hidden />

      <div className="pointer-events-none absolute top-1/3 -left-32 -z-10 h-96 w-96 rounded-full bg-primary/25 blur-[120px] animate-float" aria-hidden />
      <div className="pointer-events-none absolute bottom-1/4 -right-32 -z-10 h-96 w-96 rounded-full bg-accent/15 blur-[120px] animate-float [animation-delay:2s]" aria-hidden />

      <div className="container mx-auto px-4">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Copy */}
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3.5 py-1.5 text-xs font-medium backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Based in {site.business_location} · Free quotes
            </span>

            <h1 id="hero-title" className="mt-6 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl font-bold tracking-tight">
              Reliable tech solutions
              <span className="block bg-(image:--gradient-primary) bg-clip-text text-transparent pb-1">for homes &amp; businesses</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              Websites, PC setup, Windows installation and software support — done fast, done right, on-site or remotely.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#contact"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-(image:--gradient-primary) px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-(--shadow-elegant) transition-transform hover:scale-[1.02] active:scale-[0.99]"
              >
                Get a free quote
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href={whatsappLink(site.contact_phone_raw, "Hi RedSpark Digital, I'd like some help with…")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/50 px-7 py-3.5 text-base font-semibold backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-card/80"
              >
                <IconWhatsApp className="h-4.5 w-4.5 text-emerald-400" />
                Chat on WhatsApp
              </a>
            </div>

            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              {trust.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Service card */}
          <div className="relative hidden lg:block animate-fade-up [animation-delay:150ms]" aria-hidden>
            <div className="absolute -inset-6 rounded-[2rem] bg-(image:--gradient-primary) opacity-15 blur-3xl" />
            <div className="relative rounded-3xl border border-border/70 bg-card/70 p-6 shadow-(--shadow-card) backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What we sort out</p>
                  <p className="mt-1 font-display text-xl font-semibold">Pick a service</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-(image:--gradient-primary) shadow-(--shadow-glow)">
                  <Wrench className="h-5 w-5 text-primary-foreground" />
                </span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {quickServices.map(({ icon: Icon, title, meta }) => (
                  <li key={title} className="flex items-center gap-3.5 rounded-xl border border-border/50 bg-background/40 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Typical reply time</span>
                <span className="font-semibold text-foreground">Within hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#services"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground md:flex"
        aria-label="Scroll to services"
      >
        <span className="flex h-9 w-5 justify-center rounded-full border border-border/80 pt-1.5">
          <span className="h-2 w-1 rounded-full bg-muted-foreground animate-bounce" />
        </span>
      </a>
    </section>
  );
}
