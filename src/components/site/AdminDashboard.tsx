/**
 * AdminDashboard.tsx
 *
 * Protect this route however you like (e.g. supabase auth session check,
 * a simple password gate, or Supabase Auth UI). The component itself assumes
 * the user is already authenticated so that Supabase RLS "authenticated" policies
 * allow insert / update / delete.
 *
 * Usage: drop <AdminDashboard /> at e.g. /admin in your router.
 */

import { useEffect, useState } from "react";
import { Trash2, Plus, Pencil, X, Check, Star, LayoutGrid } from "lucide-react";
import { supabase } from "@/lib/supabase"; // adjust path to your supabase client

// ─── Types ───────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  title: string;
  tag: string;
  description: string;
  color: string;
  sort_order: number;
};

type Testimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
};

type Tab = "projects" | "testimonials";

// ─── Colour options for the project gradient picker ──────────────────────────

const COLOR_OPTIONS = [
  { label: "Orange → Pink",    value: "from-orange-500/20 to-pink-500/20" },
  { label: "Purple → Blue",    value: "from-purple-500/20 to-blue-500/20" },
  { label: "Cyan → Emerald",   value: "from-cyan-500/20 to-emerald-500/20" },
  { label: "Rose → Violet",    value: "from-rose-500/20 to-violet-500/20" },
  { label: "Yellow → Orange",  value: "from-yellow-500/20 to-orange-500/20" },
  { label: "Teal → Sky",       value: "from-teal-500/20 to-sky-500/20" },
];

// ─── Blank templates ─────────────────────────────────────────────────────────

const BLANK_PROJECT: Omit<Project, "id"> = {
  title: "",
  tag: "",
  description: "",
  color: COLOR_OPTIONS[0].value,
  sort_order: 0,
};

const BLANK_TESTIMONIAL: Omit<Testimonial, "id"> = {
  name: "",
  role: "",
  text: "",
  rating: 5,
};

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("projects");

  const [projects, setProjects] = useState<Project[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  // modal / form state
  const [projectForm, setProjectForm] = useState<Omit<Project, "id"> | (Omit<Project, "id"> & { id: string })>(BLANK_PROJECT);
  const [testimonialForm, setTestimonialForm] = useState<Omit<Testimonial, "id"> | (Omit<Testimonial, "id"> & { id: string })>(BLANK_TESTIMONIAL);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function notify(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function isEditingProject(f: typeof projectForm): f is Omit<Project, "id"> & { id: string } {
    return "id" in f;
  }

  function isEditingTestimonial(f: typeof testimonialForm): f is Omit<Testimonial, "id"> & { id: string } {
    return "id" in f;
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchAll() {
    setLoading(true);
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("portfolio_projects").select("*").order("sort_order"),
      supabase.from("testimonials").select("*").order("created_at", { ascending: false }),
    ]);
    if (p) setProjects(p);
    if (t) setTestimonials(t);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  // ── Projects CRUD ──────────────────────────────────────────────────────────

  function openNewProject() {
    setProjectForm({ ...BLANK_PROJECT, sort_order: projects.length + 1 });
    setShowProjectModal(true);
  }

  function openEditProject(p: Project) {
    setProjectForm({ ...p });
    setShowProjectModal(true);
  }

  async function saveProject() {
    if (!projectForm.title.trim() || !projectForm.tag.trim()) {
      notify("Title and tag are required.", "err");
      return;
    }
    setSaving(true);
    if (isEditingProject(projectForm)) {
      const { id, ...rest } = projectForm;
      const { error } = await supabase.from("portfolio_projects").update(rest).eq("id", id);
      if (error) { notify(error.message, "err"); } else { notify("Project updated."); }
    } else {
      const { error } = await supabase.from("portfolio_projects").insert(projectForm);
      if (error) { notify(error.message, "err"); } else { notify("Project added."); }
    }
    setSaving(false);
    setShowProjectModal(false);
    fetchAll();
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project?")) return;
    const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
    if (error) { notify(error.message, "err"); } else { notify("Project deleted."); fetchAll(); }
  }

  // ── Testimonials CRUD ──────────────────────────────────────────────────────

  function openNewTestimonial() {
    setTestimonialForm({ ...BLANK_TESTIMONIAL });
    setShowTestimonialModal(true);
  }

  function openEditTestimonial(t: Testimonial) {
    setTestimonialForm({ ...t });
    setShowTestimonialModal(true);
  }

  async function saveTestimonial() {
    if (!testimonialForm.name.trim() || !testimonialForm.text.trim()) {
      notify("Name and review text are required.", "err");
      return;
    }
    setSaving(true);
    if (isEditingTestimonial(testimonialForm)) {
      const { id, ...rest } = testimonialForm;
      const { error } = await supabase.from("testimonials").update(rest).eq("id", id);
      if (error) { notify(error.message, "err"); } else { notify("Testimonial updated."); }
    } else {
      const { error } = await supabase.from("testimonials").insert(testimonialForm);
      if (error) { notify(error.message, "err"); } else { notify("Testimonial added."); }
    }
    setSaving(false);
    setShowTestimonialModal(false);
    fetchAll();
  }

  async function deleteTestimonial(id: string) {
    if (!confirm("Delete this testimonial?")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) { notify(error.message, "err"); } else { notify("Testimonial deleted."); fetchAll(); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border transition-all
            ${toast.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="border-b border-border/60 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Site Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your portfolio and testimonials</p>
        </div>
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to site
        </a>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-8">
          {(["projects", "testimonials"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors
                ${tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground"}`}
            >
              {t === "projects" ? <><LayoutGrid className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />Projects</> : <><Star className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />Testimonials</>}
            </button>
          ))}
        </div>

        {/* ── Projects Tab ── */}
        {tab === "projects" && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Portfolio Projects <span className="ml-2 text-xs text-muted-foreground font-normal">{projects.length} items</span></h2>
              <button onClick={openNewProject} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Add Project
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />)}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">No projects yet. Add one!</div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card">
                    <div className={`w-10 h-10 rounded-lg bg-linear-to-br ${p.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.tag} · order {p.sort_order}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditProject(p)} className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteProject(p.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Testimonials Tab ── */}
        {tab === "testimonials" && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Testimonials <span className="ml-2 text-xs text-muted-foreground font-normal">{testimonials.length} items</span></h2>
              <button onClick={openNewTestimonial} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Add Testimonial
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />)}
              </div>
            ) : testimonials.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">No testimonials yet. Add one!</div>
            ) : (
              <div className="space-y-3">
                {testimonials.map((r) => (
                  <div key={r.id} className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground">· {r.role}</span>
                        <span className="flex gap-0.5 text-accent ml-auto">
                          {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">"{r.text}"</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditTestimonial(r)} className="p-2 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTestimonial(r.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ════ Project Modal ════ */}
      {showProjectModal && (
        <Modal title={isEditingProject(projectForm) ? "Edit Project" : "New Project"} onClose={() => setShowProjectModal(false)}>
          <Field label="Title">
            <input
              className="input"
              value={projectForm.title}
              onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Café Luna Website"
            />
          </Field>
          <Field label="Tag / Category">
            <input
              className="input"
              value={projectForm.tag}
              onChange={(e) => setProjectForm((f) => ({ ...f, tag: e.target.value }))}
              placeholder="Business Website"
            />
          </Field>
          <Field label="Description">
            <textarea
              className="input resize-none h-20"
              value={projectForm.description}
              onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description of the project…"
            />
          </Field>
          <Field label="Card Colour">
            <select
              className="input"
              value={projectForm.color}
              onChange={(e) => setProjectForm((f) => ({ ...f, color: e.target.value }))}
            >
              {COLOR_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Sort Order">
            <input
              type="number"
              className="input"
              value={projectForm.sort_order}
              onChange={(e) => setProjectForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            />
          </Field>
          <ModalActions onCancel={() => setShowProjectModal(false)} onSave={saveProject} saving={saving} />
        </Modal>
      )}

      {/* ════ Testimonial Modal ════ */}
      {showTestimonialModal && (
        <Modal title={isEditingTestimonial(testimonialForm) ? "Edit Testimonial" : "New Testimonial"} onClose={() => setShowTestimonialModal(false)}>
          <Field label="Client Name">
            <input
              className="input"
              value={testimonialForm.name}
              onChange={(e) => setTestimonialForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Sarah K."
            />
          </Field>
          <Field label="Role / Title">
            <input
              className="input"
              value={testimonialForm.role}
              onChange={(e) => setTestimonialForm((f) => ({ ...f, role: e.target.value }))}
              placeholder="Small business owner"
            />
          </Field>
          <Field label="Review">
            <textarea
              className="input resize-none h-24"
              value={testimonialForm.text}
              onChange={(e) => setTestimonialForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="What they said…"
            />
          </Field>
          <Field label="Rating">
            <div className="flex gap-2">
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  onClick={() => setTestimonialForm((f) => ({ ...f, rating: n }))}
                  className={`p-1.5 rounded-lg transition-colors ${testimonialForm.rating >= n ? "text-accent" : "text-muted-foreground/30"}`}
                >
                  <Star className="w-5 h-5 fill-current" />
                </button>
              ))}
            </div>
          </Field>
          <ModalActions onCancel={() => setShowTestimonialModal(false)} onSave={saveTestimonial} saving={saving} />
        </Modal>
      )}

      {/* Global input styles injected inline so the component is self-contained */}
      <style>{`
        .input {
          width: 100%;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border) / 0.6);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent/10 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-border/60 text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> Cancel
      </button>
      <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all">
        {saving ? "Saving…" : <><Check className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> Save</>}
      </button>
    </div>
  );
}