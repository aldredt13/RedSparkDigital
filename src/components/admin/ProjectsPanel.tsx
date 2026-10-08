import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpRight, ExternalLink, ImageIcon, LayoutGrid, Link2, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { useConfirm } from "./confirm-context";
import type { PanelProps, Project } from "./types";
import { Button, EmptyState, Field, IconButton, Modal, PageHeader, SearchInput, Skeleton, StarPicker, Stars } from "./ui";
import { COLOR_OPTIONS, colorOption, describeError, isValidUrl, normaliseUrl, reorder } from "./utils";

type Draft = Omit<Project, "id" | "sort_order" | "created_at"> & { id?: string };

const BLANK: Draft = { title: "", tag: "", description: "", color: COLOR_OPTIONS[0].value, rating: null, website_link: "", image_url: "" };
const BUCKET = "portfolio";
const MAX_UPLOAD = 5 * 1024 * 1024;

function storagePath(url: string | null | undefined): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

export function ProjectsPanel({ data, loading, setData, reload, intent, clearIntent }: PanelProps) {
  const confirm = useConfirm();
  const projects = data.projects;
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (intent === "create") {
      setDraft({ ...BLANK });
      clearIntent();
    }
  }, [intent, clearIntent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => [p.title, p.tag, p.description].some((v) => v?.toLowerCase().includes(q))) : projects;
  }, [projects, query]);

  async function move(index: number, dir: -1 | 1) {
    const { renumbered, changed } = reorder(projects, index, index + dir);
    setData((d) => ({ ...d, projects: renumbered }));
    const results = await Promise.all(changed.map((p) => supabase.from("portfolio_projects").update({ sort_order: p.sort_order }).eq("id", p.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(describeError(failed.error));
      reload("projects");
    }
  }

  async function remove(p: Project) {
    const ok = await confirm({ title: `Delete “${p.title}”?`, description: "It will be removed from the portfolio on the live site.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.from("portfolio_projects").delete().eq("id", p.id);
    if (error) return toast.error(describeError(error));
    const path = storagePath(p.image_url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    setData((d) => ({ ...d, projects: d.projects.filter((x) => x.id !== p.id) }));
    toast.success("Project deleted");
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Shown in the “Recent work” section, in this order."
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...BLANK })}>
            Add project
          </Button>
        }
      />

      {projects.length > 4 && <SearchInput value={query} onChange={setQuery} placeholder="Search projects…" className="mb-4 max-w-sm" />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-6 w-6" />}
          title="No projects yet"
          description="Visitors currently see “Case studies coming soon”. Add your first project to show off your work."
          action={
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...BLANK })}>
              Add your first project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const index = projects.findIndex((x) => x.id === p.id);
            return (
              <article key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 transition-colors hover:border-border">
                <ProjectCover project={p} className="aspect-[16/9]" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-accent">{p.tag}</span>
                    {!!p.rating && <Stars rating={p.rating} />}
                  </div>
                  <h3 className="mt-1 font-sans text-base font-semibold tracking-normal">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description || <em className="opacity-60">No description</em>}</p>
                  {p.website_link && (
                    <a href={p.website_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground">
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.website_link.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border/60 px-2 py-1.5">
                  <div className="flex items-center">
                    <IconButton label="Move earlier" size="iconSm" disabled={index <= 0 || !!query} onClick={() => move(index, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
                    <IconButton label="Move later" size="iconSm" disabled={index >= projects.length - 1 || !!query} onClick={() => move(index, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
                    <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">#{index + 1}</span>
                  </div>
                  <div className="flex items-center">
                    <IconButton label="Edit" size="iconSm" onClick={() => setDraft({ ...p })} icon={<Pencil className="h-3.5 w-3.5" />} />
                    <IconButton label="Delete" size="iconSm" className="hover:text-red-300" onClick={() => remove(p)} icon={<Trash2 className="h-3.5 w-3.5" />} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {draft && (
        <ProjectEditor
          draft={draft}
          tags={[...new Set(projects.map((p) => p.tag).filter(Boolean))]}
          nextOrder={Math.max(0, ...projects.map((p) => p.sort_order)) + 1}
          onClose={() => setDraft(null)}
          onSaved={(saved, isNew) => {
            setData((d) => ({ ...d, projects: isNew ? [...d.projects, saved] : d.projects.map((x) => (x.id === saved.id ? saved : x)) }));
            setDraft(null);
          }}
        />
      )}
    </>
  );
}

function ProjectCover({ project, className }: { project: Pick<Project, "title" | "color" | "image_url">; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [project.image_url]);
  const initials = project.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div className={cn("relative overflow-hidden bg-linear-to-br", project.color, className)}>
      {project.image_url && !broken ? (
        <img src={project.image_url} alt="" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-4xl font-bold text-foreground/70">{initials || <ImageIcon className="h-8 w-8 opacity-50" />}</span>
        </div>
      )}
      {project.image_url && broken && (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-red-200">Image failed to load</span>
      )}
    </div>
  );
}

function ProjectEditor({
  draft: initial,
  tags,
  nextOrder,
  onClose,
  onSaved,
}: {
  draft: Draft;
  tags: string[];
  nextOrder: number;
  onClose: () => void;
  onSaved: (project: Project, isNew: boolean) => void;
}) {
  const ids = useId();
  const [draft, setDraft] = useState<Draft>({ ...initial, website_link: initial.website_link ?? "", image_url: initial.image_url ?? "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = !initial.id;

  const errors = {
    title: draft.title.trim() ? null : "Give the project a title.",
    tag: draft.tag.trim() ? null : "Add a category, e.g. “Business website”.",
    website_link: isValidUrl(draft.website_link ?? "") ? null : "That doesn't look like a valid link.",
    image_url: isValidUrl(draft.image_url ?? "") ? null : "That doesn't look like a valid image URL.",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > MAX_UPLOAD) return toast.error("Images must be 5 MB or smaller.");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `projects/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "31536000", contentType: file.type });
    setUploading(false);
    if (error) {
      const missingBucket = /bucket not found|not found/i.test(error.message);
      return toast.error(
        missingBucket ? "Image uploads aren't set up yet — run supabase/sql/01_security_and_notifications.sql, or paste an image URL instead." : describeError(error),
      );
    }
    set("image_url", supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    toast.success("Image uploaded");
  }

  async function save() {
    setShowErrors(true);
    if (hasErrors) return;
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      tag: draft.tag.trim(),
      description: draft.description.trim(),
      color: draft.color,
      rating: draft.rating,
      website_link: normaliseUrl(draft.website_link ?? "") || null,
      image_url: normaliseUrl(draft.image_url ?? "") || null,
    };
    const query = isNew
      ? supabase.from("portfolio_projects").insert({ ...payload, sort_order: nextOrder }).select().single()
      : supabase.from("portfolio_projects").update(payload).eq("id", initial.id!).select().single();
    const { data, error } = await query;
    setSaving(false);
    if (error || !data) return toast.error(describeError(error, "Couldn't save the project"));
    toast.success(isNew ? "Project added — it's live on the site" : "Project updated");
    onSaved(data as Project, isNew);
  }

  return (
    <Modal
      title={isNew ? "New project" : "Edit project"}
      description="Changes go live on the site as soon as you save."
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {isNew ? "Add project" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-6 lg:grid-cols-[1fr_320px]"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor={`${ids}-title`} error={showErrors ? errors.title : null}>
              <input id={`${ids}-title`} className="field-input text-sm" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Café Luna website" autoFocus />
            </Field>
            <Field label="Category" htmlFor={`${ids}-tag`} error={showErrors ? errors.tag : null}>
              <input id={`${ids}-tag`} list={`${ids}-tags`} className="field-input text-sm" value={draft.tag} onChange={(e) => set("tag", e.target.value)} placeholder="Business website" />
              <datalist id={`${ids}-tags`}>
                {tags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field label="Description" htmlFor={`${ids}-desc`} hint={`${draft.description.length} characters · the card shows the first two lines`}>
            <textarea id={`${ids}-desc`} rows={4} className="field-input text-sm" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="What you built, for whom, and the result…" />
          </Field>

          <Field label="Website link" htmlFor={`${ids}-link`} optional error={showErrors ? errors.website_link : null}>
            <input
              id={`${ids}-link`}
              inputMode="url"
              className="field-input text-sm"
              value={draft.website_link ?? ""}
              onChange={(e) => set("website_link", e.target.value)}
              onBlur={() => set("website_link", normaliseUrl(draft.website_link ?? ""))}
              placeholder="example.com"
            />
          </Field>

          <Field
            label="Cover image"
            htmlFor={`${ids}-img`}
            optional
            error={showErrors ? errors.image_url : null}
            hint="Upload an image (max 5 MB) or paste a link. 16:9 screenshots look best."
          >
            <div className="flex gap-2">
              <input
                id={`${ids}-img`}
                inputMode="url"
                className="field-input min-w-0 flex-1 text-sm"
                value={draft.image_url ?? ""}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://…/screenshot.jpg"
              />
              {draft.image_url && <IconButton label="Remove image" onClick={() => set("image_url", "")} icon={<X className="h-4 w-4" />} />}
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} icon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}>
                Upload
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Client rating" optional>
              <StarPicker value={draft.rating} onChange={(v) => set("rating", v)} allowClear />
            </Field>
            <Field label="Card colour" hint={draft.image_url ? "Shown behind the image while it loads" : colorOption(draft.color).label}>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={draft.color === c.value}
                    onClick={() => set("color", c.value)}
                    className={cn(
                      "h-7 w-7 rounded-full bg-linear-to-br transition-transform hover:scale-110",
                      c.dot,
                      draft.color === c.value && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                    )}
                  />
                ))}
              </div>
            </Field>
          </div>
          <button type="submit" className="hidden" />
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Live preview</p>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
            <ProjectCover project={{ title: draft.title || "Project", color: draft.color, image_url: draft.image_url }} className="aspect-[16/10]" />
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">{draft.tag || "Category"}</span>
                {!!draft.rating && <Stars rating={draft.rating} />}
              </div>
              <p className="mt-1.5 font-semibold">{draft.title || "Project title"}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{draft.description || "Your description will appear here."}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                View project <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </div>
          {draft.website_link && isValidUrl(draft.website_link) && (
            <a href={normaliseUrl(draft.website_link)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> Test link
            </a>
          )}
        </div>
      </form>
    </Modal>
  );
}
