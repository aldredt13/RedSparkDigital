import { toast } from "sonner";

export const COLOR_OPTIONS = [
  { label: "Orange → Pink", value: "from-orange-500/20 to-pink-500/20", dot: "from-orange-400 to-pink-400" },
  { label: "Purple → Blue", value: "from-purple-500/20 to-blue-500/20", dot: "from-purple-400 to-blue-400" },
  { label: "Cyan → Emerald", value: "from-cyan-500/20 to-emerald-500/20", dot: "from-cyan-400 to-emerald-400" },
  { label: "Rose → Violet", value: "from-rose-500/20 to-violet-500/20", dot: "from-rose-400 to-violet-400" },
  { label: "Yellow → Orange", value: "from-yellow-500/20 to-orange-500/20", dot: "from-yellow-400 to-orange-400" },
  { label: "Teal → Sky", value: "from-teal-500/20 to-sky-500/20", dot: "from-teal-400 to-sky-400" },
];

export function colorOption(value: string) {
  return COLOR_OPTIONS.find((c) => c.value === value) ?? COLOR_OPTIONS[0];
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function dayGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString("en-ZA", { month: "long" });
  return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

/** Adds https:// when someone pastes "example.com" */
export function normaliseUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function isValidUrl(raw: string): boolean {
  if (!raw.trim()) return true;
  try {
    const u = new URL(normaliseUrl(raw));
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const DISCORD_WEBHOOK_RE = /^https:\/\/((ptb|canary)\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

export async function copyText(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} to clipboard`);
  } catch {
    toast.error("Couldn't access the clipboard");
  }
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** Turn a Supabase/PostgREST error into something an admin can act on. */
export function describeError(error: { message?: string; code?: string } | null | undefined, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "")) {
    return "You don't have permission to do that. Make sure you're signed in with an admin account.";
  }
  return error.message || fallback;
}

/**
 * Move an item within a sorted list and return the rows whose sort_order
 * changed. Orders are renumbered 1..n so duplicate/zero orders get fixed too.
 */
export function reorder<T extends { id: string; sort_order: number }>(items: T[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const renumbered = next.map((item, i) => ({ ...item, sort_order: i + 1 }));
  const changed = renumbered.filter((item) => items.find((o) => o.id === item.id)?.sort_order !== item.sort_order);
  return { renumbered, changed };
}
