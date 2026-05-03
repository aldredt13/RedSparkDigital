import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase"; // adjust path to your supabase client

type Project = {
  id: string;
  title: string;
  tag: string;
  description: string;
  color: string;
  sort_order: number;
};

export function Portfolio() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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
    <section id="portfolio" className="py-24 md:py-32 bg-card/30 border-y border-border/50">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Portfolio</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">Recent work</h2>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card animate-pulse h-64" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((p) => (
              <article
                key={p.id}
                className="group rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-primary/50 transition-all"
              >
                <div
                  className={`relative aspect-4/3 bg-linear-to-br ${p.color} flex items-center justify-center overflow-hidden`}
                >
                  <div className="absolute inset-4 rounded-lg bg-background/80 backdrop-blur flex items-center justify-center font-display text-2xl font-bold text-foreground/80 group-hover:scale-105 transition-transform">
                    {p.title.split(" ")[0]}
                  </div>
                </div>
                <div className="p-6">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">{p.tag}</span>
                  <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}