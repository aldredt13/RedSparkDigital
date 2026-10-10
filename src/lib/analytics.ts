/**
 * First-party analytics for the public site.
 *
 * Events are batched and sent to the `track_events` database function
 * (supabase/sql/02_analytics.sql) — no third-party trackers or cookies. The
 * visitor IP is captured server-side by that function.
 *
 * Not tracked: bots, browsers sending Global Privacy Control / Do Not Track,
 * the local dev server, and browsers where an admin has opened the dashboard
 * (the dashboard sets EXCLUDE_KEY, with a toggle in the Analytics tab).
 */

import { getVisitorGeo } from "./currency";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_events`;
const API_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

const VISITOR_KEY = "rsd:vid";
const SESSION_KEY = "rsd:session";
/** "1" = don't count this browser; "0" = an admin explicitly chose to be counted */
export const EXCLUDE_KEY = "rsd:analytics-exclude";
/** Set to "1" to send events from the dev server and log them to the console */
const DEBUG_KEY = "rsd:analytics-debug";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_AFTER_MS = 60 * 1000;
const FLUSH_DELAY_MS = 4000;
const HEARTBEAT_EVERY_S = 60;

type EventType = "pageview" | "event" | "engagement";
type Props = Record<string, string | number | boolean | null>;
type QueuedEvent = { type: EventType; name?: string; path?: string; props?: Props; duration_s?: number; scroll_pct?: number };

type Session = {
  id: string;
  last: number;
  /** Active seconds across every page load in this session */
  active: number;
  sections: string[];
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

// ─── Storage helpers (storage can be blocked — never let analytics break the site) ──

function read(key: string, storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, storage: Storage = localStorage) {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Visitor, session, attribution ────────────────────────────────────────────

let visitorId = "";
let session: Session | null = null;

function getVisitorId(): string {
  if (visitorId) return visitorId;
  const stored = read(VISITOR_KEY);
  visitorId = stored && /^[\w-]{8,64}$/.test(stored) ? stored : randomId();
  if (visitorId !== stored) write(VISITOR_KEY, visitorId);
  return visitorId;
}

const REFERRER_NAMES: Array<[RegExp, string]> = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$/, "YouTube"],
];

function attribution(): Pick<Session, "referrer" | "utm_source" | "utm_medium" | "utm_campaign"> {
  const params = new URLSearchParams(location.search);
  let referrer: string | null = null;
  try {
    const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    if (host && host !== location.hostname.replace(/^www\./, "")) {
      referrer = REFERRER_NAMES.find(([re]) => re.test(host))?.[1] ?? host;
    }
  } catch {
    /* malformed referrer */
  }
  // In-app browsers often strip the referrer
  const ua = navigator.userAgent;
  if (!referrer && /FBAN|FBAV/.test(ua)) referrer = "Facebook";
  if (!referrer && /Instagram/.test(ua)) referrer = "Instagram";

  return {
    referrer,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  };
}

function getSession(): Session {
  const now = Date.now();
  if (!session) {
    try {
      session = JSON.parse(read(SESSION_KEY) ?? "null");
    } catch {
      session = null;
    }
  }
  if (!session || now - session.last > SESSION_TIMEOUT_MS) {
    session = { id: randomId(), last: now, active: 0, sections: [], ...attribution() };
  }
  session.last = now;
  write(SESSION_KEY, JSON.stringify(session));
  return session;
}

// ─── Device ───────────────────────────────────────────────────────────────────

function describeDevice() {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const tablet = iPadOS || /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua);
  const mobile = !tablet && (nav.userAgentData?.mobile ?? /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua));

  const browser = /FBAN|FBAV/.test(ua)
    ? "Facebook app"
    : /Instagram/.test(ua)
      ? "Instagram app"
      : /Edg\//.test(ua)
        ? "Edge"
        : /OPR\/|Opera/.test(ua)
          ? "Opera"
          : /SamsungBrowser/.test(ua)
            ? "Samsung Internet"
            : /Firefox|FxiOS/.test(ua)
              ? "Firefox"
              : /Chrome|CriOS/.test(ua)
                ? "Chrome"
                : /Safari/.test(ua)
                  ? "Safari"
                  : "Other";

  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) || iPadOS
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "ChromeOS"
          : /Mac OS X/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Other";

  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    /* ignore */
  }

  return {
    device: tablet ? "tablet" : mobile ? "mobile" : "desktop",
    browser,
    os,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language ?? null,
    timezone,
  };
}

// ─── Sending ──────────────────────────────────────────────────────────────────

let enabled = false;
let debug = false;
let baseContext: Record<string, string | null> | null = null;
const queue: QueuedEvent[] = [];
let flushTimer = 0;

function flush(keepalive = false) {
  window.clearTimeout(flushTimer);
  flushTimer = 0;
  if (!baseContext || queue.length === 0) return;

  const s = getSession();
  const events = queue.splice(0, 50);
  const body = JSON.stringify({
    p_context: {
      ...baseContext,
      visitor_id: getVisitorId(),
      session_id: s.id,
      path: location.pathname,
      referrer: s.referrer,
      utm_source: s.utm_source,
      utm_medium: s.utm_medium,
      utm_campaign: s.utm_campaign,
    },
    p_events: events,
  });
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: API_KEY };
  if (API_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${API_KEY}`;
  if (debug) console.debug("[analytics]", events);
  fetch(ENDPOINT, { method: "POST", headers, body, keepalive }).catch(() => {});
  if (queue.length) flush(keepalive);
}

function enqueue(event: QueuedEvent) {
  if (!enabled) return;
  queue.push({ path: location.pathname, ...event });
  if (!flushTimer) flushTimer = window.setTimeout(() => flush(), FLUSH_DELAY_MS);
}

/** Record an interaction, e.g. track("whatsapp_click", { where: "hero" }). Safe to call anytime. */
export function track(name: string, props?: Props) {
  enqueue({ type: "event", name, props });
}

function shouldTrack(): boolean {
  debug = read(DEBUG_KEY) === "1";
  if (read(EXCLUDE_KEY) === "1") return false;
  if (import.meta.env.DEV && !debug) return false;
  if (browserSignal()) return false;
  if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|preview/i.test(navigator.userAgent)) return false;
  return !!import.meta.env.VITE_SUPABASE_URL && !!API_KEY;
}

// ─── Engagement, sections, clicks ─────────────────────────────────────────────

function watchEngagement() {
  let lastInput = Date.now();
  let maxScroll = 0;
  let nextHeartbeat = 10;
  const markActive = () => (lastInput = Date.now());
  for (const evt of ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"]) {
    window.addEventListener(evt, markActive, { passive: true });
  }
  window.addEventListener(
    "scroll",
    () => {
      const doc = document.documentElement;
      const pct = Math.round(((window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1)) * 100);
      maxScroll = Math.max(maxScroll, Math.min(pct, 100));
    },
    { passive: true },
  );

  const sendEngagement = (keepalive: boolean) => {
    const s = getSession();
    enqueue({ type: "engagement", duration_s: s.active, scroll_pct: maxScroll });
    flush(keepalive);
  };

  window.setInterval(() => {
    if (document.hidden || Date.now() - lastInput > IDLE_AFTER_MS) return;
    const s = getSession();
    s.active += 1;
    write(SESSION_KEY, JSON.stringify(s));
    if (s.active >= nextHeartbeat) {
      nextHeartbeat = s.active < 10 ? 10 : s.active + HEARTBEAT_EVERY_S;
      sendEngagement(false);
    }
  }, 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) sendEngagement(true);
  });
  window.addEventListener("pagehide", () => sendEngagement(true));
}

function watchSections() {
  const seen = new Set(getSession().sections);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id;
        if (!entry.isIntersecting || !id || seen.has(id)) continue;
        seen.add(id);
        const s = getSession();
        s.sections = [...seen];
        write(SESSION_KEY, JSON.stringify(s));
        track("section_view", { section: id });
      }
    },
    { threshold: 0.35 },
  );
  const observeAll = () => document.querySelectorAll<HTMLElement>("main section[id]").forEach((el) => observer.observe(el));
  observeAll();
  // Some sections (e.g. testimonials) only appear once their data loads
  window.setTimeout(observeAll, 4000);
}

function watchClicks() {
  document.addEventListener(
    "click",
    (e) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const where =
        link.closest<HTMLElement>("[data-where]")?.dataset.where ?? link.closest<HTMLElement>("section[id]")?.id ?? (link.closest("footer") ? "footer" : "page");
      const href = link.getAttribute("href") ?? "";
      if (/wa\.me\//.test(link.href)) track("whatsapp_click", { where });
      else if (href.startsWith("mailto:")) track("email_click", { where });
      else if (href.startsWith("tel:")) track("phone_click", { where });
      else if (href === "#contact") track("cta_click", { where, label: link.textContent?.trim().slice(0, 40) ?? "" });
      else if (link.hostname && link.hostname !== location.hostname) track("outbound_click", { where, host: link.hostname });
    },
    { capture: true },
  );
}

// ─── Visitor controls (privacy page) ──────────────────────────────────────────

export type TrackingStatus = "tracked" | "opted-out" | "browser-signal";

function browserSignal(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** What applies to this browser right now (client-side only). */
export function trackingStatus(): { status: TrackingStatus; visitorId: string | null } {
  if (browserSignal()) return { status: "browser-signal", visitorId: null };
  if (read(EXCLUDE_KEY) === "1") return { status: "opted-out", visitorId: null };
  return { status: "tracked", visitorId: read(VISITOR_KEY) };
}

/** Opting out stops tracking and forgets this browser's analytics ID. */
export function setAnalyticsOptOut(optOut: boolean) {
  try {
    if (optOut) {
      localStorage.setItem(EXCLUDE_KEY, "1");
      localStorage.removeItem(VISITOR_KEY);
      localStorage.removeItem(SESSION_KEY);
      enabled = false;
      queue.length = 0;
    } else {
      localStorage.removeItem(EXCLUDE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

let started = false;

/** Call once when the public site mounts. */
export function startAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!shouldTrack()) return;
  enabled = true;

  getVisitorId();
  getSession();
  enqueue({ type: "pageview", props: location.hash ? { hash: location.hash } : undefined });
  watchEngagement();
  watchSections();
  watchClicks();

  // Wait (briefly) for the shared location lookup so events carry country/city
  const device = describeDevice();
  Promise.race([getVisitorGeo(), new Promise<null>((r) => setTimeout(() => r(null), 3000))]).then((geo) => {
    baseContext = { ...device, country: geo?.country ?? null, region: geo?.region ?? null, city: geo?.city ?? null, network: geo?.network ?? null };
    flush();
  });
}
