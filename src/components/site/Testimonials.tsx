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
    <section className="py-14 md:py-18">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-8">
          <span className="text-sm font-semibold text-accent uppercase tracking-wider">Testimonials</span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold">What clients say</h2>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card/50 animate-pulse h-36" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-14 h-14 rounded-2xl border border-border/60 bg-card flex items-center justify-center mb-3 text-2xl">
              💬
            </div>
            <p className="text-base font-medium text-foreground/70">No reviews yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Client testimonials will appear here once added.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <figure
                key={r.id}
                className="rounded-xl border border-border/60 bg-(image:--gradient-card) p-5 backdrop-blur"
              >
                <div className="flex gap-0.5 text-accent mb-3">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="text-sm text-foreground/90 leading-relaxed">"{r.text}"</blockquote>
                <figcaption className="mt-4 text-sm">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}