import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  children,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  children?: ReactNode;
  /** id for the heading, so the section can be labelled with aria-labelledby */
  id?: string;
}) {
  const centered = align === "center";
  return (
    <div className={`max-w-2xl mb-12 md:mb-16 ${centered ? "mx-auto text-center" : ""}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 id={id} className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.1]">
        {title}
      </h2>
      {description && <p className="mt-4 text-muted-foreground text-base sm:text-lg leading-relaxed">{description}</p>}
      {children}
    </div>
  );
}
