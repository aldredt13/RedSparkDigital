import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EyeOff, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { EXCLUDE_KEY } from "../../../lib/analytics";
import { useConfirm } from "../confirm-context";
import { Badge, Button, Card, CardHeader, IconButton, Switch } from "../ui";
import { relativeTime } from "../utils";
import { excludeIp, fetchExcludedIps, fetchMyIp, includeIp, type ExcludedIp } from "./api";

function readExcluded() {
  try {
    return localStorage.getItem(EXCLUDE_KEY) !== "0";
  } catch {
    return true;
  }
}

/** "Don't track me": per-browser switch + IP addresses the database never records. */
export function ExclusionsCard({ onChanged }: { onChanged: () => void }) {
  const confirm = useConfirm();
  const [browserExcluded, setBrowserExcluded] = useState(readExcluded);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [list, setList] = useState<ExcludedIp[] | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [draftIp, setDraftIp] = useState("");
  const [draftLabel, setDraftLabel] = useState("");

  const refresh = useCallback(async () => {
    const [ips, mine] = await Promise.all([fetchExcludedIps(), fetchMyIp()]);
    setList(ips);
    setMyIp(mine);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function toggleBrowser(countMe: boolean) {
    try {
      localStorage.setItem(EXCLUDE_KEY, countMe ? "0" : "1");
    } catch {
      /* ignore */
    }
    setBrowserExcluded(!countMe);
  }

  async function exclude(ip: string, label?: string) {
    const ok = await confirm({
      title: `Stop tracking ${ip}?`,
      description:
        "Visits from this IP address won't be recorded any more, and visits already recorded from it will be deleted. " +
        "Home and office internet usually keeps the same IP for a long time; mobile data changes often and can be shared by many people, so for your phone the browser switch above is more reliable.",
      confirmLabel: "Exclude IP",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const deleted = await excludeIp(ip, label);
      toast.success(deleted ? `${ip} excluded — ${deleted.toLocaleString()} recorded events deleted` : `${ip} excluded`);
      setDraftIp("");
      setDraftLabel("");
      await refresh();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(ip: string) {
    try {
      await includeIp(ip);
      toast.success(`${ip} will be tracked again`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const myIpExcluded = !!myIp && !!list?.some((x) => x.ip === myIp);

  return (
    <Card>
      <CardHeader icon={<EyeOff className="h-4 w-4" />} title="Don't track me" description="Keep your own visits out of the statistics" />
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Switch
            checked={browserExcluded}
            onChange={(v) => toggleBrowser(!v)}
            label="Ignore this browser"
            description="Works on any network. Open the dashboard once on each of your devices (phone, laptop) to cover them all."
          />

          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <p className="text-sm font-medium">Your current IP address</p>
            {list === undefined ? (
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
              </p>
            ) : list === null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Run <code className="rounded bg-secondary px-1">supabase/sql/03_analytics_ip_grouping.sql</code> to exclude IP addresses.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-sm">{myIp ?? "Unknown"}</span>
                {myIpExcluded ? (
                  <Badge tone="success">Not tracked</Badge>
                ) : (
                  myIp && (
                    <Button size="sm" variant="primary" loading={busy} onClick={() => exclude(myIp, "My connection")}>
                      Exclude my IP
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Excluded IP addresses</p>
          {list && list.length > 0 ? (
            <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
              {list.map((x) => (
                <li key={x.ip} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono">{x.ip}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {x.label ? `${x.label} · ` : ""}added {relativeTime(x.created_at)}
                    </span>
                  </span>
                  <IconButton label={`Track ${x.ip} again`} size="iconSm" onClick={() => remove(x.ip)} icon={<X className="h-3.5 w-3.5" />} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">No IP addresses excluded yet.</p>
          )}

          {list !== null && (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draftIp.trim()) exclude(draftIp.trim(), draftLabel);
              }}
            >
              <input
                value={draftIp}
                onChange={(e) => setDraftIp(e.target.value)}
                placeholder="IP address"
                aria-label="IP address to exclude"
                className="field-input h-9 w-40 py-0 font-mono text-xs"
              />
              <input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="Label (e.g. Office)"
                aria-label="Label"
                className="field-input h-9 min-w-0 flex-1 py-0 text-xs"
              />
              <Button size="sm" type="submit" icon={<Plus className="h-3.5 w-3.5" />} disabled={!draftIp.trim() || busy} className="h-9">
                Exclude
              </Button>
            </form>
          )}
        </div>
      </div>
      <p className="flex items-start gap-2 border-t border-border/60 px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" />
        Visitors get a random ID stored in their browser — no cookies or third-party trackers. IP addresses are deleted after 90 days and all visit data after 13
        months. Browsers sending “Do Not Track” or Global Privacy Control aren't tracked.
      </p>
    </Card>
  );
}
