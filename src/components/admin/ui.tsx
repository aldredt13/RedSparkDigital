import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, Search, Star, X } from "lucide-react";
import { cn } from "../../lib/utils";

// ─── Buttons ──────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS = {
  primary: "bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary-glow",
  secondary: "border border-border bg-card text-foreground hover:bg-secondary",
  ghost: "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
  danger: "border border-red-500/30 text-red-300 hover:bg-red-500/10",
  dangerSolid: "bg-red-600 text-white hover:bg-red-500",
  success: "border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  icon: "h-9 w-9",
  iconSm: "h-8 w-8",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, size = "icon", variant = "ghost", ...props }: ButtonProps & { label: string }) {
  return <Button aria-label={label} title={label} size={size} variant={variant} className={className} {...props} />;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border/70 bg-card/60", className)}>{children}</div>;
}

export function CardHeader({ icon, title, description, actions }: { icon?: ReactNode; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-sans text-sm font-semibold tracking-normal">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-muted-foreground">{icon}</span>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

export function Badge({ tone = "neutral", className, children }: { tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info"; className?: string; children: ReactNode }) {
  const tones = {
    neutral: "border-border bg-secondary/60 text-muted-foreground",
    primary: "border-primary/30 bg-primary/15 text-primary-glow",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    danger: "border-red-500/30 bg-red-500/15 text-red-300",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", tones[tone], className)}>
      {children}
    </span>
  );
}

// ─── Form controls ────────────────────────────────────────────────────────────

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  action,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground/80">
          {label}
          {optional && <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span>}
        </label>
        {action}
      </div>
      {children}
      {error ? <p className="text-xs text-red-300">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input h-10 py-0 pl-9 text-sm"
        aria-label={placeholder}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: Array<{ value: NoInfer<T>; label: string; count?: number }>;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border/70 bg-card/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors",
            value === o.value ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count != null && <span className={cn("tabular-nums", value === o.value ? "text-primary-glow" : "text-muted-foreground/70")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  ariaLabel,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  /** Accessible name when there's no visible label */
  ariaLabel?: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const toggle = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-primary bg-primary" : "border-border bg-secondary",
      )}
    >
      <span className={cn("inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[1.3rem]" : "translate-x-[0.2rem]")} />
    </button>
  );
  if (!label) return toggle;
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </label>
      {toggle}
    </div>
  );
}

export function StarPicker({ value, onChange, allowClear }: { value: number | null; onChange: (v: number | null) => void; allowClear?: boolean }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(allowClear && value === n ? null : n)}
          className="rounded-md p-1 transition-transform hover:scale-110"
        >
          <Star className={cn("h-6 w-6 transition-colors", (value ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
        </button>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">
        {value ? `${value}/5` : "No rating"}
        {allowClear && value ? " · click again to clear" : ""}
      </span>
    </div>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5 text-amber-400", className)} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i < rating ? "fill-current" : "fill-none opacity-25")} />
      ))}
    </span>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

function useOverlay(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useOverlay(onClose);
  const titleId = useId();
  const widths = { md: "sm:max-w-lg", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("flex max-h-[94svh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl animate-pop-in sm:max-h-[88vh] sm:rounded-2xl", widths[size])}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <IconButton label="Close" size="iconSm" onClick={onClose} icon={<X className="h-4 w-4" />} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-background/40 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ onClose, children, labelledBy }: { onClose: () => void; children: ReactNode; labelledBy?: string }) {
  useOverlay(onClose);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right"
      >
        {children}
      </div>
    </div>
  );
}
