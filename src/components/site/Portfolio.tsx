import { useEffect, useState } from "react";
import { X, ExternalLink, Star } from "lucide-react";
import { supabase } from "../../lib/supabase"; // adjust path to your supabase client

type Project = {
  id: string;
  title: string;
  tag: string;
  description: string;
  color: string;
  sort_order: number;
  rating?: number;        // 1–5, optional
  // optional extended fields
  website_link?: string;
  image_url?: string;
};

function ProjectOverlay({ project, onClose }: { project: Project; onClose: () => void }) {
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-lg bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Image / colour banner — no text overlay ── */}
        <div className={`relative aspect-video bg-linear-to-br ${project.color} overflow-hidden`}>
          {project.image_url ? (
            <img
              src={project.image_url}
              alt={project.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            /* Fallback: subtle pattern using the colour gradient */
            <div className="absolute inset-0 opacity-40"
              style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
            />
          )}
          {/* Thin bottom fade so content below feels connected */}
          <div className="absolute bottom-0 inset-x-0 h-10 bg-linear-to-t from-card to-transparent" />
        </div>

        {/* ── Close button ── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-black/40 backdrop-blur hover:bg-black/60 text-white/80 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Content ── */}
        <div className="px-6 pt-4 pb-6 space-y-4">

          {/* Tag + title + rating block */}
          <div>
            <span className="inline-block text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-2 py-0.5 rounded-full mb-2">
              {project.tag}
            </span>
            <h3 className="text-xl font-bold leading-snug">{project.title}</h3>
            {project.rating != null && project.rating > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < project.rating! ? "text-accent fill-current" : "text-muted-foreground/20 fill-none"}`}
                  />
                ))}
                <span className="ml-1 text-xs text-muted-foreground">{project.rating}.0 / 5</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border/40" />

          {/* Description */}
          {project.description?.trim() && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          )}

          {/* CTA */}
          {project.website_link?.trim() && (
            <a
              href={project.website_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
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
    <section id="portfolio" className="py-16 md:py-20 bg-card/30 border-y border-border/50">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-10">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Portfolio</span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold">Recent work</h2>
        </div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card animate-pulse h-56" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl border border-border/60 bg-card flex items-center justify-center mb-4 text-2xl">
              🗂️
            </div>
            <p className="text-lg font-medium text-foreground/70">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Recent work will appear here once added.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {projects.map((p) => (
              <article
                key={p.id}
                onClick={() => setSelected(p)}
                className="group rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-primary/50 transition-all cursor-pointer"
              >
                <div
                  className={`relative aspect-video bg-linear-to-br ${p.color} flex items-center justify-center overflow-hidden`}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-50"
                    />
                  ) : null}
                  <div className="absolute inset-4 rounded-lg bg-background/80 backdrop-blur flex items-center justify-center font-display text-xl font-bold text-foreground/80 group-hover:scale-105 transition-transform">
                    {p.title.split(" ")[0]}
                  </div>
                </div>
                <div className="p-4">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">{p.tag}</span>
                  <h3 className="mt-1.5 text-base font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                  {p.rating != null && p.rating > 0 && (
                    <div className="flex gap-0.5 mt-2.5 text-accent">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < p.rating! ? "fill-current" : "fill-none opacity-20"}`} />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && <ProjectOverlay project={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}