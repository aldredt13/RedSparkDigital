import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, Eye, EyeOff, Send, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { IconDiscord } from "../site/icons";
import { useConfirm } from "./confirm-context";
import type { PanelProps } from "./types";
import { Badge, Button, Card, CardHeader, Field, IconButton, PageHeader, Skeleton, Switch } from "./ui";
import { describeError, DISCORD_WEBHOOK_RE } from "./utils";

const URL_KEY = "discord_webhook_url";
const ENABLED_KEY = "discord_notifications_enabled";

export function NotificationsPanel({ data, loading, setData }: PanelProps) {
  const ids = useId();
  const confirm = useConfirm();
  const savedUrl = data.settings[URL_KEY] ?? "";
  const enabled = (data.settings[ENABLED_KEY] ?? "true") === "true";

  const [draft, setDraft] = useState(savedUrl);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => setDraft(savedUrl), [savedUrl]);

  const trimmed = draft.trim();
  const draftValid = !trimmed || DISCORD_WEBHOOK_RE.test(trimmed);
  const dirty = trimmed !== savedUrl;
  const status = !savedUrl ? "off" : enabled ? "on" : "paused";

  async function upsert(entries: Array<{ key: string; value: string }>) {
    const { error } = await supabase.from("site_settings").upsert(entries);
    if (error) throw error;
    setData((d) => ({ ...d, settings: { ...d.settings, ...Object.fromEntries(entries.map((e) => [e.key, e.value])) } }));
  }

  async function saveUrl(value = trimmed) {
    if (value && !DISCORD_WEBHOOK_RE.test(value)) return toast.error("That isn't a Discord webhook URL.");
    setSaving(true);
    try {
      await upsert([{ key: URL_KEY, value }]);
      toast.success(value ? "Webhook saved" : "Webhook removed");
    } catch (err) {
      toast.error(describeError(err as { message?: string }));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(next: boolean) {
    try {
      await upsert([{ key: ENABLED_KEY, value: String(next) }]);
      toast.success(next ? "Discord alerts turned on" : "Discord alerts paused");
    } catch (err) {
      toast.error(describeError(err as { message?: string }));
    }
  }

  async function removeWebhook() {
    const ok = await confirm({ title: "Remove the webhook?", description: "You'll stop getting Discord alerts until you add a webhook again.", confirmLabel: "Remove", tone: "danger" });
    if (ok) {
      setDraft("");
      saveUrl("");
    }
  }

  async function sendTest() {
    const url = trimmed && DISCORD_WEBHOOK_RE.test(trimmed) ? trimmed : savedUrl;
    if (!url) return;
    setTesting(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "🔔 Test notification",
              description: "Your Discord webhook is set up correctly. New contact form enquiries will be posted here.",
              color: 0xe05555,
              footer: { text: "RedSpark Digital · Admin dashboard" },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(res.status === 404 ? "Discord says this webhook doesn't exist — it may have been deleted." : `Discord returned ${res.status}`);
      toast.success(dirty ? "Test sent — remember to save the new webhook" : "Test notification sent to Discord");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const masked = savedUrl ? savedUrl.replace(/(\/webhooks\/\d+\/)(.{4}).+$/, "$1$2••••••••") : "";

  return (
    <>
      <PageHeader title="Notifications" description="Get a Discord message the moment someone sends an enquiry." />

      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            {/* Status */}
            <div
              className={cn(
                "flex items-center gap-4 rounded-2xl border p-5",
                status === "on" && "border-emerald-500/30 bg-emerald-500/[0.07]",
                status === "paused" && "border-amber-500/30 bg-amber-500/[0.07]",
                status === "off" && "border-border/70 bg-card/60",
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  status === "on" ? "bg-emerald-500/15 text-emerald-300" : status === "paused" ? "bg-amber-500/15 text-amber-300" : "bg-secondary text-muted-foreground",
                )}
              >
                {status === "on" ? <BellRing className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{status === "on" ? "Alerts are on" : status === "paused" ? "Alerts are paused" : "Not set up yet"}</p>
                <p className="text-sm text-muted-foreground">
                  {status === "on"
                    ? "Every new enquiry is posted to your Discord channel."
                    : status === "paused"
                      ? "Enquiries are still saved here, but Discord won't be pinged."
                      : "Add a Discord webhook below to start getting alerts."}
                </p>
              </div>
              <Switch checked={enabled && !!savedUrl} disabled={!savedUrl} onChange={toggle} ariaLabel="Discord alerts" />
            </div>

            {/* Webhook */}
            <Card>
              <CardHeader
                icon={<IconDiscord className="h-4 w-4" />}
                title="Discord webhook"
                description={savedUrl ? <span className="font-mono">{masked}</span> : "Paste the webhook URL from your Discord channel settings."}
                actions={savedUrl ? <Badge tone="success">Connected</Badge> : <Badge>Not connected</Badge>}
              />
              <form
                className="space-y-4 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveUrl();
                }}
              >
                <Field label="Webhook URL" htmlFor={`${ids}-url`} error={!draftValid ? "Should look like https://discord.com/api/webhooks/123…/abc…" : null}>
                  <div className="flex gap-2">
                    <input
                      id={`${ids}-url`}
                      type={reveal ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      className="field-input min-w-0 flex-1 font-mono text-xs"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/…"
                      aria-invalid={!draftValid}
                    />
                    <IconButton label={reveal ? "Hide URL" : "Show URL"} variant="secondary" onClick={() => setReveal((r) => !r)} icon={reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} />
                  </div>
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" variant="primary" loading={saving} disabled={!dirty || !draftValid}>
                    Save webhook
                  </Button>
                  <Button icon={<Send className="h-4 w-4" />} loading={testing} disabled={!(trimmed && draftValid) && !savedUrl} onClick={sendTest}>
                    Send test
                  </Button>
                  {dirty && (
                    <Button variant="ghost" onClick={() => setDraft(savedUrl)}>
                      Undo
                    </Button>
                  )}
                  {savedUrl && (
                    <Button variant="ghost" className="ml-auto hover:text-red-300" icon={<Trash2 className="h-4 w-4" />} onClick={removeWebhook}>
                      Remove
                    </Button>
                  )}
                </div>
                <p className="flex items-start gap-2 rounded-lg bg-background/50 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-emerald-400" />
                  Alerts are sent from the database the moment an enquiry is saved, so the webhook URL stays private and is never shown to visitors.
                </p>
              </form>
            </Card>

            <details className="group rounded-2xl border border-border/70 bg-card/60">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                How do I get a webhook URL? <span className="ml-1 text-muted-foreground group-open:hidden">Show steps</span>
              </summary>
              <ol className="list-decimal space-y-1.5 px-5 pb-5 pl-10 text-sm text-muted-foreground">
                <li>In Discord, open the server and channel where you want alerts.</li>
                <li>
                  Click the gear icon next to the channel name → <strong className="text-foreground">Integrations</strong> → <strong className="text-foreground">Webhooks</strong>.
                </li>
                <li>
                  Click <strong className="text-foreground">New Webhook</strong>, give it a name like “RedSpark enquiries”.
                </li>
                <li>
                  Click <strong className="text-foreground">Copy Webhook URL</strong>, paste it above, save, then send a test.
                </li>
              </ol>
            </details>
          </div>

          {/* Preview */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">What an alert looks like</p>
            <div className="rounded-2xl border border-border/70 bg-[#313338] p-4 font-[system-ui] text-[#dbdee1]">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5865f2]">
                  <IconDiscord className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold text-white">RedSpark enquiries</span>
                    <span className="ml-1.5 rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold text-white">APP</span>
                    <span className="ml-2 text-xs text-[#949ba4]">Today at 09:41</span>
                  </p>
                  <div className="mt-1.5 rounded border-l-4 border-[#e05555] bg-[#2b2d31] p-3">
                    <p className="text-sm font-semibold text-white">📬 New enquiry — Package: Website Starter</p>
                    <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                      {[
                        ["Name", "Jane Doe"],
                        ["Email", "jane@example.com"],
                        ["Phone", "+264 81 000 0000"],
                      ].map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <p className="font-semibold text-white">{k}</p>
                          <p className="truncate">{v}</p>
                        </div>
                      ))}
                      <div className="col-span-3">
                        <p className="font-semibold text-white">Package price</p>
                        <p>from $299.99 USD</p>
                      </div>
                      <div className="col-span-3">
                        <p className="font-semibold text-white">Message</p>
                        <p>Hi! I'd like a simple website for my salon, ideally live by next month.</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-[#949ba4]">RedSpark Digital · Contact form</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
