import { useCallback, useEffect, useRef, useState } from "react";
import { X, ExternalLink, Star, ArrowUpRight, FolderOpen } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SectionHeader } from "./SectionHeader";

type Project = {
  id: string;
  title: string;
  tag: string;
  description: string;
  color: string;
  sort_order: number;
  rating?: number | null;
  website_link?: string | null;
  image_url?: string | null;
};

function Stars({ rating, size = "h-3.5 w-3.5" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5 text-amber-400" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} ${i < rating ? "fill-current" : "fill-none opacity-25"}`} />
      ))}
    </div>
  );
}

function Cover({ project, className = "" }: { project: Project; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = project.title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={`relative overflow-hidden bg-linear-to-br ${project.color} ${className}`}>
      {project.image_url && !broken ? (
        <img
          src={project.image_url}
          alt={`${project.title} preview`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-30"
            style={{ backgroundImage: "radial-gradient(circle, oklch(1 0 0 / 0.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <span className="relative font-display text-5xl font-bold text-foreground/80">{initials}</span>
        </div>
      )}
    </div>
  );
}

function ProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        className="relative max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border/60 bg-card shadow-2xl animate-pop-in sm:rounded-2xl"
      >
        <Cover project={project} className="aspect-video" />
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg bg-black/50 p-2 text-white/85 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4 p-6">
          <div>
            <span className="inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-accent">{project.tag}</span>
            <h3 id="project-dialog-title" className="mt-2 text-2xl font-bold leading-snug">
              {project.title}
            </h3>
            {!!project.rating && (
              <div className="mt-2 flex items-center gap-2">
                <Stars rating={project.rating} size="h-4 w-4" />
                <span className="text-xs text-muted-foreground">{project.rating}/5 client rating</span>
              </div>
            )}
          </div>
          {project.description?.trim() && <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{project.description}</p>}
          {project.website_link?.trim() && (
            <a
              href={project.website_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              Visit website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function Portfolio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);
  const closeDialog = useCallback(() => setSelected(null), []);

  useEffect(() => {
    supabase
      .from("portfolio_projects")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setProjects(data);
        setLoading(false);
      });
  }, []);

  return (
    <section id="portfolio" aria-labelledby="portfolio-title" className="border-y border-border/50 bg-card/30 py-24 md:py-32">
      <div className="container mx-auto px-4">
        <SectionHeader
          id="portfolio-title"
          eyebrow="Portfolio"
          title="Recent work"
          description="A few of the projects we've delivered for clients."
        />

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-border/60 bg-card" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-14 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderOpen className="h-6 w-6" />
            </span>
            <p className="text-lg font-semibold">Case studies coming soon</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">We're putting together write-ups of recent jobs. Want examples of our work in the meantime? Just ask.</p>
            <a href="#contact" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-glow">
              Ask for examples <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-(--shadow-card)"
              >
                <Cover project={p} className="aspect-[16/10] w-full" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">{p.tag}</span>
                    {!!p.rating && <Stars rating={p.rating} />}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    View project <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <ProjectDialog project={selected} onClose={closeDialog} />}
    </section>
  );
}
