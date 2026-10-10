import { useEffect, useState } from "react";
import { Quote, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { initialData } from "../../lib/initial-data";
import { SectionHeader } from "./SectionHeader";

type Testimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
};

export function Testimonials() {
  const [reviews, setReviews] = useState<Testimonial[]>(() => (initialData().testimonials as Testimonial[] | undefined) ?? []);
  const [loading, setLoading] = useState(() => !initialData().testimonials);

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

  // Only render once there are reviews — no empty state or placeholder heading for visitors (or crawlers)
  if (loading || reviews.length === 0) return null;

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-title"
      className="py-24 md:py-32"
    >
      <div className="container mx-auto px-4">
        <SectionHeader
          id="testimonials-title"
          eyebrow="Testimonials"
          title="What clients say"
        >
          <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/50 px-4 py-2 text-sm">
            <span className="flex gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.round(average) ? "fill-current" : "fill-none opacity-30"}`}
                />
              ))}
            </span>
            <span className="font-semibold">{average.toFixed(1)}</span>
            <span className="text-muted-foreground">
              from {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </span>
          </div>
        </SectionHeader>

        <div className="columns-1 gap-5 md:columns-2 lg:columns-3 [&>*]:mb-5">
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="relative break-inside-avoid rounded-2xl border border-border/60 bg-(image:--gradient-card) p-6 backdrop-blur"
            >
              <Quote
                className="absolute right-5 top-5 h-8 w-8 text-primary/15"
                aria-hidden
              />
              <div
                className="flex gap-0.5 text-amber-400"
                aria-label={`Rated ${r.rating} out of 5`}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < r.rating ? "fill-current" : "fill-none opacity-25"}`}
                  />
                ))}
              </div>
              <blockquote className="mt-4 text-[0.9375rem] leading-relaxed text-foreground/90">
                “{r.text}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border/50 pt-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {r.name}
                  </span>
                  {r.role && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.role}
                    </span>
                  )}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
