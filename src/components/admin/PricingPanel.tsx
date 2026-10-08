import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Copy, DollarSign, EyeOff, GripVertical, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { formatPrice, formatUsd, useCurrency } from "../../lib/currency";
import { useConfirm } from "./confirm-context";
import type { PanelProps, PricingPlan } from "./types";
import { Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, Skeleton, Switch } from "./ui";
import { describeError, reorder } from "./utils";

type Draft = Omit<PricingPlan, "id" | "sort_order"> & { id?: string; features: string[] };

const BLANK: Draft = { name: "", description: "", highlight: false, price_usd_cents: 0, active: true, features: [""] };

async function replaceFeatures(planId: string, features: string[]) {
  const { error: delError } = await supabase.from("pricing_features").delete().eq("plan_id", planId);
  if (delError) return delError;
  if (features.length === 0) return null;
  const { error } = await supabase.from("pricing_features").insert(features.map((feature, i) => ({ plan_id: planId, feature, sort_order: i + 1 })));
  return error;
}

export function PricingPanel({ data, loading, setData, reload }: PanelProps) {
  const confirm = useConfirm();
  const { local } = useCurrency();
  const { plans, features } = data;
  const [draft, setDraft] = useState<Draft | null>(null);

  const featuresFor = (planId: string) => features.filter((f) => f.plan_id === planId).sort((a, b) => a.sort_order - b.sort_order);

  async function patchPlan(plan: PricingPlan, patch: Partial<PricingPlan>, message: string) {
    setData((d) => ({ ...d, plans: d.plans.map((p) => (p.id === plan.id ? { ...p, ...patch } : p)) }));
    const { error } = await supabase.from("pricing_plans").update(patch).eq("id", plan.id);
    if (error) {
      toast.error(describeError(error));
      reload("pricing");
    } else toast.success(message);
  }

  async function move(index: number, dir: -1 | 1) {
    const { renumbered, changed } = reorder(plans, index, index + dir);
    setData((d) => ({ ...d, plans: renumbered }));
    const results = await Promise.all(changed.map((p) => supabase.from("pricing_plans").update({ sort_order: p.sort_order }).eq("id", p.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(describeError(failed.error));
      reload("pricing");
    }
  }

  async function duplicate(plan: PricingPlan) {
    const { data: copy, error } = await supabase
      .from("pricing_plans")
      .insert({
        name: `${plan.name} (copy)`,
        description: plan.description,
        highlight: false,
        price_usd_cents: plan.price_usd_cents,
        active: false,
        sort_order: Math.max(0, ...plans.map((p) => p.sort_order)) + 1,
      })
      .select()
      .single();
    if (error || !copy) return toast.error(describeError(error));
    const featError = await replaceFeatures(copy.id, featuresFor(plan.id).map((f) => f.feature));
    if (featError) toast.error(describeError(featError));
    await reload("pricing");
    toast.success("Plan duplicated — it's hidden until you make it visible");
  }

  async function remove(plan: PricingPlan) {
    const ok = await confirm({
      title: `Delete “${plan.name}”?`,
      description: "The plan and its features will be removed. Past enquiries about it keep their package name. Tip: hide the plan instead if you might bring it back.",
      confirmLabel: "Delete plan",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("pricing_plans").delete().eq("id", plan.id);
    if (error) return toast.error(describeError(error));
    setData((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== plan.id), features: d.features.filter((f) => f.plan_id !== plan.id) }));
    toast.success("Plan deleted");
  }

  return (
    <>
      <PageHeader
        title="Pricing"
        description={
          <>
            Prices are stored in US dollars and converted for each visitor's currency
            {local.code !== "USD" && <> — you're seeing {local.code} previews based on your location</>}.
          </>
        }
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...BLANK, features: [""] })}>
            Add plan
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-6 w-6" />}
          title="No pricing plans yet"
          description="Add a package and it will appear in the Pricing section and as an option in the contact form."
          action={
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...BLANK, features: [""] })}>
              Add your first plan
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan, index) => {
            const feats = featuresFor(plan.id);
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card/60 transition-colors",
                  plan.highlight ? "border-primary/50" : "border-border/70",
                  !plan.active && "border-dashed opacity-70",
                )}
              >
                <div className="flex-1 p-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {plan.highlight && (
                      <Badge tone="primary">
                        <Sparkles className="h-2.5 w-2.5" /> Most popular
                      </Badge>
                    )}
                    {!plan.active && (
                      <Badge tone="warning">
                        <EyeOff className="h-2.5 w-2.5" /> Hidden
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-2 font-sans text-lg font-semibold tracking-normal">{plan.name}</h3>
                  {plan.description && <p className="mt-0.5 text-sm text-muted-foreground">{plan.description}</p>}
                  <p className="mt-4 font-display text-3xl font-bold">{formatUsd(plan.price_usd_cents)}</p>
                  {local.code !== "USD" && <p className="text-xs text-muted-foreground">≈ {formatPrice(plan.price_usd_cents, local)} for visitors paying in {local.code}</p>}
                  <ul className="mt-4 space-y-1.5 border-t border-border/50 pt-4 text-sm">
                    {feats.slice(0, 5).map((f) => (
                      <li key={f.id} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span className="text-foreground/85">{f.feature}</span>
                      </li>
                    ))}
                    {feats.length > 5 && <li className="pl-5 text-xs text-muted-foreground">+{feats.length - 5} more</li>}
                    {feats.length === 0 && <li className="text-xs italic text-muted-foreground">No features listed</li>}
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                  <div className="flex items-center gap-2 pl-1">
                    <Switch checked={plan.active} onChange={(v) => patchPlan(plan, { active: v }, v ? "Plan is now visible" : "Plan hidden from the site")} ariaLabel="Visible on site" />
                    <span className="text-xs text-muted-foreground">{plan.active ? "Visible" : "Hidden"}</span>
                  </div>
                  <div className="flex items-center">
                    <IconButton label="Move earlier" size="iconSm" disabled={index === 0} onClick={() => move(index, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
                    <IconButton label="Move later" size="iconSm" disabled={index === plans.length - 1} onClick={() => move(index, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
                    <IconButton label="Duplicate" size="iconSm" onClick={() => duplicate(plan)} icon={<Copy className="h-3.5 w-3.5" />} />
                    <IconButton
                      label="Edit"
                      size="iconSm"
                      onClick={() => setDraft({ ...plan, features: feats.length ? feats.map((f) => f.feature) : [""] })}
                      icon={<Pencil className="h-3.5 w-3.5" />}
                    />
                    <IconButton label="Delete" size="iconSm" className="hover:text-red-300" onClick={() => remove(plan)} icon={<Trash2 className="h-3.5 w-3.5" />} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {draft && (
        <PlanEditor
          draft={draft}
          nextOrder={Math.max(0, ...plans.map((p) => p.sort_order)) + 1}
          onClose={() => setDraft(null)}
          onSaved={async () => {
            setDraft(null);
            await reload("pricing");
          }}
        />
      )}
    </>
  );
}

function PlanEditor({ draft: initial, nextOrder, onClose, onSaved }: { draft: Draft; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const ids = useId();
  const { local } = useCurrency();
  const [draft, setDraft] = useState<Draft>(initial);
  const [priceText, setPriceText] = useState(initial.price_usd_cents ? (initial.price_usd_cents / 100).toFixed(2).replace(/\.00$/, "") : "");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const featureRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isNew = !initial.id;

  const cents = Math.round((parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0) * 100);
  const errors = {
    name: draft.name.trim() ? null : "Give the plan a name.",
    price: cents > 0 ? null : "Enter a starting price above $0.",
  };
  const cleanFeatures = draft.features.map((f) => f.trim()).filter(Boolean);

  const setFeatures = (fn: (f: string[]) => string[]) => setDraft((d) => ({ ...d, features: fn(d.features) }));
  const focusFeature = (i: number) => requestAnimationFrame(() => featureRefs.current[i]?.focus());

  function moveFeature(i: number, dir: -1 | 1) {
    setFeatures((f) => {
      const next = [...f];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  }

  async function save() {
    setShowErrors(true);
    if (errors.name || errors.price) return;
    setSaving(true);
    const payload = { name: draft.name.trim(), description: draft.description.trim(), highlight: draft.highlight, active: draft.active, price_usd_cents: cents };
    let planId = initial.id;
    if (isNew) {
      const { data, error } = await supabase.from("pricing_plans").insert({ ...payload, sort_order: nextOrder }).select("id").single();
      if (error || !data) {
        setSaving(false);
        return toast.error(describeError(error, "Couldn't create the plan"));
      }
      planId = data.id;
    } else {
      const { error } = await supabase.from("pricing_plans").update(payload).eq("id", planId!);
      if (error) {
        setSaving(false);
        return toast.error(describeError(error, "Couldn't save the plan"));
      }
    }
    const featError = await replaceFeatures(planId!, cleanFeatures);
    setSaving(false);
    if (featError) return toast.error(`Plan saved, but features couldn't be updated: ${describeError(featError)}`);
    toast.success(isNew ? "Plan added" : "Plan updated");
    onSaved();
  }

  return (
    <Modal
      title={isNew ? "New pricing plan" : "Edit pricing plan"}
      description="Shown in the Pricing section and as a package option in the contact form."
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {isNew ? "Add plan" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Plan name" htmlFor={`${ids}-name`} error={showErrors ? errors.name : null}>
              <input id={`${ids}-name`} className="field-input text-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Website Starter" autoFocus />
            </Field>
            <Field label="Starting price (USD)" htmlFor={`${ids}-price`} error={showErrors ? errors.price : null}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  id={`${ids}-price`}
                  inputMode="decimal"
                  className="field-input pl-7 text-sm tabular-nums"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.]/g, ""))}
                  onBlur={() => cents > 0 && setPriceText((cents / 100).toFixed(2).replace(/\.00$/, ""))}
                  placeholder="49"
                />
              </div>
            </Field>
          </div>
          {cents > 0 && local.code !== "USD" && <p className="-mt-3 text-xs text-muted-foreground">Visitors paying in {local.code} will see about {formatPrice(cents, local)}.</p>}

          <Field label="Short description" htmlFor={`${ids}-desc`} optional>
            <input id={`${ids}-desc`} className="field-input text-sm" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Perfect for a quick tune-up." />
          </Field>

          <div className="grid gap-3 rounded-xl border border-border/60 bg-background/40 p-4 sm:grid-cols-2">
            <Switch checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Visible on site" description="Hidden plans stay saved here" />
            <Switch checked={draft.highlight} onChange={(v) => setDraft({ ...draft, highlight: v })} label="“Most popular” badge" description="Makes this card stand out" />
          </div>

          <Field label="Features" hint="Press Enter to add the next line. Pasting several lines adds them all.">
            <ol className="space-y-2">
              {draft.features.map((feat, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <input
                    ref={(el) => {
                      featureRefs.current[i] = el;
                    }}
                    className="field-input min-w-0 flex-1 py-2 text-sm"
                    value={feat}
                    placeholder={`Feature ${i + 1}`}
                    onChange={(e) => setFeatures((f) => f.map((x, j) => (j === i ? e.target.value : x)))}
                    onPaste={(e) => {
                      const lines = e.clipboardData.getData("text").split(/\r?\n/).map((l) => l.replace(/^[-•*\s]+/, "").trim()).filter(Boolean);
                      if (lines.length > 1) {
                        e.preventDefault();
                        setFeatures((f) => [...f.slice(0, i), ...(f[i].trim() ? [f[i]] : []), ...lines, ...f.slice(i + 1)]);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setFeatures((f) => [...f.slice(0, i + 1), "", ...f.slice(i + 1)]);
                        focusFeature(i + 1);
                      } else if (e.key === "Backspace" && !feat && draft.features.length > 1) {
                        e.preventDefault();
                        setFeatures((f) => f.filter((_, j) => j !== i));
                        focusFeature(Math.max(0, i - 1));
                      }
                    }}
                  />
                  <IconButton label="Move up" size="iconSm" disabled={i === 0} onClick={() => moveFeature(i, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
                  <IconButton label="Move down" size="iconSm" disabled={i === draft.features.length - 1} onClick={() => moveFeature(i, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
                  <IconButton
                    label="Remove"
                    size="iconSm"
                    disabled={draft.features.length === 1}
                    onClick={() => setFeatures((f) => f.filter((_, j) => j !== i))}
                    icon={<X className="h-3.5 w-3.5" />}
                  />
                </li>
              ))}
            </ol>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 self-start"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => {
                setFeatures((f) => [...f, ""]);
                focusFeature(draft.features.length);
              }}
            >
              Add feature
            </Button>
          </Field>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Live preview</p>
          <div className={cn("relative rounded-2xl border p-6", draft.highlight ? "border-primary/60 bg-(image:--gradient-card)" : "border-border/60 bg-background", !draft.active && "opacity-60")}>
            {draft.highlight && (
              <span className="absolute -top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-(image:--gradient-primary) px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                <Sparkles className="h-2.5 w-2.5" /> Most popular
              </span>
            )}
            <p className="font-semibold">{draft.name || "Plan name"}</p>
            {draft.description && <p className="mt-1 text-xs text-muted-foreground">{draft.description}</p>}
            <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground">From</p>
            <p className="font-display text-3xl font-bold">{formatPrice(cents, local)}</p>
            {local.code !== "USD" && <p className="text-[11px] text-muted-foreground">≈ {formatUsd(cents)} USD</p>}
            <ul className="mt-4 space-y-1.5 border-t border-border/50 pt-4 text-xs">
              {(cleanFeatures.length ? cleanFeatures : ["Your features will appear here"]).map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            {!draft.active && <p className="mt-4 text-center text-[11px] font-semibold text-amber-300">Hidden from visitors</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

