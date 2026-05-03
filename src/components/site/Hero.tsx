import heroImg from "../../assets/hero-tech.jpg";
import { ArrowRight, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

// ─── Particles ────────────────────────────────────────────────────────────────

const PARTICLE_COLOR   = { r: 239, g: 68,  b: 68  }; // red-500
const LINE_COLOR       = { r: 252, g: 165, b: 165 }; // red-300 for lines
const PARTICLE_COUNT   = 70;
const MAX_DISTANCE     = 140;
const GRAB_DISTANCE    = 130;
const PARTICLE_SPEED   = 0.8;
const PARTICLE_SIZE    = 2.2;

interface Point { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

function createParticle(w: number, h: number): Point {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * PARTICLE_SPEED,
    vy: (Math.random() - 0.5) * PARTICLE_SPEED,
    r: Math.random() * PARTICLE_SIZE + 0.8,
    opacity: Math.random() * 0.5 + 0.2,
  };
}

function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const particles = useRef<Point[]>([]);
  const mouse     = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  const raf       = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particles.current = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(canvas.width, canvas.height)
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => { mouse.current = { x: null, y: null }; };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      for (let i = 0; i < 4; i++) {
        const p = createParticle(canvas.width, canvas.height);
        p.x = x + (Math.random() - 0.5) * 40;
        p.y = y + (Math.random() - 0.5) * 40;
        particles.current.push(p);
      }
    };

    const dist = (ax: number, ay: number, bx: number, by: number) =>
      Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

    const draw = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      // update + draw particles
      for (const p of particles.current) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.r) p.x = w + p.r;
        if (p.x > w + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = h + p.r;
        if (p.y > h + p.r) p.y = -p.r;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR.r},${PARTICLE_COLOR.g},${PARTICLE_COLOR.b},${p.opacity})`;
        ctx.fill();
      }

      // draw particle-to-particle lines
      const ps = particles.current;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const d = dist(ps[i].x, ps[i].y, ps[j].x, ps[j].y);
          if (d <= MAX_DISTANCE) {
            const alpha = (0.25 * (1 - d / MAX_DISTANCE));
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.strokeStyle = `rgba(${LINE_COLOR.r},${LINE_COLOR.g},${LINE_COLOR.b},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // grab lines to mouse
      const mx = mouse.current.x, my = mouse.current.y;
      if (mx !== null && my !== null) {
        for (const p of ps) {
          const d = dist(mx, my, p.x, p.y);
          if (d <= GRAB_DISTANCE) {
            const alpha = 0.6 * (1 - d / GRAB_DISTANCE);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mx, my);
            ctx.strokeStyle = `rgba(${LINE_COLOR.r},${LINE_COLOR.g},${LINE_COLOR.b},${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        }
      }

      raf.current = requestAnimationFrame(draw);
    };

    resize();
    draw();

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticles(canvasRef);

  return (
    <section className="relative min-h-svh flex items-center overflow-hidden pt-16">

      {/* ── Background layers ── */}
      <div className="absolute inset-0 -z-10">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={1080}
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-(image:--gradient-hero) opacity-80" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/30 to-background" />
      </div>

      {/* ── Particles canvas (sits just above bg, below content) ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />

      {/* ── Ambient glows ── */}
      <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-[120px] animate-float pointer-events-none" style={{ zIndex: 1 }} />
      <div className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-[120px] animate-float pointer-events-none" style={{ animationDelay: "2s", zIndex: 1 }} />

      {/* ── Hero content ── */}
      <div className="container mx-auto px-4 relative" style={{ zIndex: 2 }}>
        <div className="max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-accent" />
            Trusted tech support, on-site &amp; remote
          </span>

          <h1 className="mt-6 text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Reliable Tech Solutions
            <span className="block bg-(image:--gradient-primary) bg-clip-text text-transparent">
              for Homes &amp; Businesses
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
            Websites, PC setup, Windows installation, and software support — done fast, done right.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#contact"
              className="group inline-flex items-center gap-2 rounded-lg bg-(image:--gradient-primary) px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-(--shadow-elegant) hover:scale-[1.02] transition-transform"
            >
              Get a Quote
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#services"
              className="inline-flex items-center rounded-lg border border-border bg-card/40 backdrop-blur px-7 py-3.5 text-base font-semibold hover:bg-card/70 transition-colors"
            >
              View Services
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}