import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "../../lib/supabase"; // adjust path to your supabase client

type Testimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
};

export function Testimonials() {
  const [reviews, setReviews] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setReviews(data);
        setLoading(false);
      });
  }, []);

  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-16">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Testimonials</span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold">What clients say</h2>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card/50 animate-pulse h-48" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {reviews.map((r) => (
              <figure
                key={r.id}
                className="rounded-2xl border border-border/60 bg-(image:--gradient-card) p-6 backdrop-blur"
              >
                <div className="flex gap-1 text-accent mb-4">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="text-foreground/90 leading-relaxed">"{r.text}"</blockquote>
                <figcaption className="mt-5 text-sm">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-muted-foreground">{r.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}