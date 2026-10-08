import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquareQuote, Pencil, Plus, Quote, Star, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useConfirm } from "./confirm-context";
import type { PanelProps, Testimonial } from "./types";
import { Button, EmptyState, Field, IconButton, Modal, PageHeader, SearchInput, Segmented, Skeleton, StarPicker, Stars } from "./ui";
import { describeError, initials, relativeTime } from "./utils";

type Draft = Omit<Testimonial, "id" | "created_at"> & { id?: string };
const BLANK: Draft = { name: "", role: "", text: "", rating: 5 };
const TEXT_SOFT_LIMIT = 400;

export function TestimonialsPanel({ data, loading, setData, intent, clearIntent }: PanelProps) {
  const confirm = useConfirm();
  const reviews = data.testimonials;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "rating">("newest");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (intent === "create") {
      setDraft({ ...BLANK });
      clearIntent();
    }
  }, [intent, clearIntent]);

  const average = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? reviews.filter((r) => [r.name, r.role, r.text].some((v) => v?.toLowerCase().includes(q))) : reviews;
    return sort === "rating" ? [...list].sort((a, b) => b.rating - a.rating) : list;
  }, [reviews, query, sort]);

  async function remove(r: Testimonial) {
    const ok = await confirm({ title: `Delete ${r.name}'s review?`, description: "It will disappear from the live site.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", r.id);
    if (error) return toast.error(describeError(error));
    setData((d) => ({ ...d, testimonials: d.testimonials.filter((x) => x.id !== r.id) }));
    toast.success("Review deleted");
  }

  return (
    <>
      <PageHeader
        title="Testimonials"
        description={reviews.length ? "Shown in the “What clients say” section, newest first." : "The reviews section is hidden on the site until you add one."}
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...BLANK })}>
            Add testimonial
          </Button>
        }
      />

      {!loading && reviews.length > 0 && (
        <div className="mb-6 grid gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 sm:grid-cols-[auto_1fr] sm:gap-8">
          <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
            <p className="font-display text-4xl font-bold">{average.toFixed(1)}</p>
            <div>
              <Stars rating={Math.round(average)} />
              <p className="mt-1 text-xs text-muted-foreground">
                {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {distribution.map(({ n, count }) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="flex w-6 items-center gap-0.5 text-muted-foreground">
                  {n}
                  <Star className="h-3 w-3 fill-current" />
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviews.length > 3 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search reviews…" className="sm:max-w-xs sm:flex-1" />
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "newest", label: "Newest" },
              { value: "rating", label: "Highest rated" },
            ]}
          />
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote className="h-6 w-6" />}
          title="No testimonials yet"
          description="Reviews from happy clients are one of the best ways to win new work. Add your first one."
          action={
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...BLANK })}>
              Add a testimonial
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((r) => (
            <figure key={r.id} className="group relative flex flex-col rounded-2xl border border-border/70 bg-card/60 p-5 transition-colors hover:border-border">
              <div className="flex items-start justify-between gap-3">
                <Stars rating={r.rating} />
                <div className="-mr-2 -mt-2 flex opacity-60 transition-opacity group-hover:opacity-100">
                  <IconButton label="Edit" size="iconSm" onClick={() => setDraft({ ...r })} icon={<Pencil className="h-3.5 w-3.5" />} />
                  <IconButton label="Delete" size="iconSm" className="hover:text-red-300" onClick={() => remove(r)} icon={<Trash2 className="h-3.5 w-3.5" />} />
                </div>
              </div>
              <blockquote className="mt-3 line-clamp-5 flex-1 text-sm leading-relaxed text-foreground/90">“{r.text}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-border/50 pt-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials(r.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.role || "—"}</span>
                </span>
                {r.created_at && <span className="text-[11px] text-muted-foreground">{relativeTime(r.created_at)}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {draft && (
        <TestimonialEditor
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={(saved, isNew) => {
            setData((d) => ({ ...d, testimonials: isNew ? [saved, ...d.testimonials] : d.testimonials.map((x) => (x.id === saved.id ? saved : x)) }));
            setDraft(null);
          }}
        />
      )}
    </>
  );
}

function TestimonialEditor({ draft: initial, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (t: Testimonial, isNew: boolean) => void }) {
  const ids = useId();
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const isNew = !initial.id;
  const errors = {
    name: draft.name.trim() ? null : "Add the client's name.",
    text: draft.text.trim() ? null : "Add what the client said.",
  };

  async function save() {
    setShowErrors(true);
    if (errors.name || errors.text) return;
    setSaving(true);
    const payload = { name: draft.name.trim(), role: draft.role.trim(), text: draft.text.trim(), rating: draft.rating };
    const { data, error } = isNew
      ? await supabase.from("testimonials").insert(payload).select().single()
      : await supabase.from("testimonials").update(payload).eq("id", initial.id!).select().single();
    setSaving(false);
    if (error || !data) return toast.error(describeError(error, "Couldn't save the testimonial"));
    toast.success(isNew ? "Testimonial added" : "Testimonial updated");
    onSaved(data as Testimonial, isNew);
  }

  return (
    <Modal
      title={isNew ? "New testimonial" : "Edit testimonial"}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {isNew ? "Add testimonial" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" htmlFor={`${ids}-name`} error={showErrors ? errors.name : null}>
              <input id={`${ids}-name`} className="field-input text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Sarah K." autoFocus />
            </Field>
            <Field label="Role or company" htmlFor={`${ids}-role`} optional>
              <input id={`${ids}-role`} className="field-input text-sm" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Owner, Café Luna" />
            </Field>
          </div>
          <Field
            label="Review"
            htmlFor={`${ids}-text`}
            error={showErrors ? errors.text : null}
            hint={
              <span className={draft.text.length > TEXT_SOFT_LIMIT ? "text-amber-300" : undefined}>
                {draft.text.length} characters{draft.text.length > TEXT_SOFT_LIMIT ? " · shorter reviews read better on the site" : ""}
              </span>
            }
          >
            <textarea id={`${ids}-text`} rows={6} className="field-input text-sm" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="What they said about working with you…" />
          </Field>
          <Field label="Rating">
            <StarPicker value={draft.rating} onChange={(v) => setDraft({ ...draft, rating: v ?? 5 })} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Live preview</p>
          <figure className="relative rounded-2xl border border-border/60 bg-(image:--gradient-card) p-5">
            <Quote className="absolute right-4 top-4 h-7 w-7 text-primary/15" />
            <Stars rating={draft.rating} />
            <blockquote className="mt-3 text-sm leading-relaxed text-foreground/90">“{draft.text || "Their review will appear here."}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-border/50 pt-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{initials(draft.name || "?")}</span>
              <span>
                <span className="block text-sm font-semibold">{draft.name || "Client name"}</span>
                {draft.role && <span className="block text-xs text-muted-foreground">{draft.role}</span>}
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </Modal>
  );
}
