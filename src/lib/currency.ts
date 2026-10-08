/**
 * Visitor currency detection.
 *
 * Prices are stored in USD cents and converted for the visitor's country.
 * Country lookup tries several free HTTPS providers in turn (the old
 * ip-api.com call only works over plain HTTP, so it always failed on the
 * live HTTPS site and everyone saw USD), then falls back to the browser's
 * time zone / language. The result is cached in localStorage for 12 hours
 * and shared between every component through a tiny external store.
 */

import { useEffect, useSyncExternalStore } from "react";

export type Currency = {
  code: string;
  symbol: string;
  /** Units of this currency per 1 USD */
  rate: number;
};

export type CurrencyPreference = "local" | "USD";

export const USD: Currency = { code: "USD", symbol: "$", rate: 1 };

// ─── Country → currency ───────────────────────────────────────────────────────

const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries(
  (
    "AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR " +
    "AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:BGN BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB " +
    "BQ:USD BR:BRL BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD CA:CAD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD " +
    "CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:ANG CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD " +
    "DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR " +
    "GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR " +
    "GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR " +
    "IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD " +
    "KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR " +
    "LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MQ:EUR " +
    "MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NG:NGN NI:NIO " +
    "NL:EUR NO:NOK NP:NPR NR:AUD NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PR:USD " +
    "PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG " +
    "SE:SEK SG:SGD SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:ANG SY:SYP " +
    "SZ:SZL TC:USD TD:XAF TG:XOF TH:THB TJ:TJS TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD " +
    "TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WS:WST " +
    "XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:USD"
  )
    .split(" ")
    .map((pair) => pair.split(":") as [string, string]),
);

// Used only when every IP lookup fails (ad blockers, offline providers)
const TIMEZONE_COUNTRY: Record<string, string> = {
  "Africa/Windhoek": "NA", "Africa/Johannesburg": "ZA", "Africa/Gaborone": "BW",
  "Africa/Lusaka": "ZM", "Africa/Harare": "ZW", "Africa/Maputo": "MZ", "Africa/Luanda": "AO",
  "Africa/Maseru": "LS", "Africa/Mbabane": "SZ", "Africa/Blantyre": "MW", "Africa/Lagos": "NG",
  "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Dar_es_Salaam": "TZ", "Africa/Kampala": "UG",
  "Africa/Kigali": "RW", "Africa/Cairo": "EG", "Europe/London": "GB", "Europe/Dublin": "IE",
  "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Amsterdam": "NL", "Europe/Madrid": "ES",
  "Europe/Rome": "IT", "Europe/Lisbon": "PT", "Asia/Kolkata": "IN", "Asia/Dubai": "AE",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Sao_Paulo": "BR",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US",
};

// Friendlier symbols than Intl gives for some currencies (e.g. NAD → "N$" not "$")
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", CAD: "C$", CHF: "CHF ", CNY: "¥",
  HKD: "HK$", SGD: "S$", ZAR: "R", NAD: "N$", BWP: "P", ZMW: "K", MWK: "MK", NGN: "₦",
  GHS: "₵", KES: "KSh ", TZS: "TSh ", UGX: "USh ", INR: "₹", BRL: "R$", MXN: "MX$",
  AED: "AED ", SAR: "SAR ", NZD: "NZ$", SEK: "kr ", NOK: "kr ", DKK: "kr ", PLN: "zł ",
  TRY: "₺", RUB: "₽", IDR: "Rp ", THB: "฿", PHP: "₱", MYR: "RM", VND: "₫", PKR: "₨",
  EGP: "E£", ILS: "₪", AOA: "Kz ", MZN: "MT ", LSL: "L ", SZL: "E ",
};

function symbolFor(code: string): string {
  if (CURRENCY_SYMBOLS[code]) return CURRENCY_SYMBOLS[code];
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value;
    if (part && part !== code) return part;
  } catch {
    /* unknown code */
  }
  return `${code} `;
}

// ─── Detection ────────────────────────────────────────────────────────────────

const CACHE_KEY = "rsd:currency:v3";
const PREF_KEY = "rsd:currency-pref";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export type VisitorGeo = { country: string | null; region: string | null; city: string | null };

type Cached = { geo: VisitorGeo; currency: Currency; ts: number };

async function fetchWithTimeout(url: string, ms = 3000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

// First provider also gives region + city (used by the site analytics); the rest are country-only fallbacks
const GEO_PROVIDERS: Array<() => Promise<Partial<VisitorGeo>>> = [
  async () => {
    const d = await (await fetchWithTimeout("https://get.geojs.io/v1/ip/geo.json")).json();
    return { country: d.country_code ?? null, region: d.region ?? null, city: d.city ?? null };
  },
  async () => ({ country: (await (await fetchWithTimeout("https://api.country.is/")).json()).country ?? null }),
  async () => {
    const text = await (await fetchWithTimeout("https://www.cloudflare.com/cdn-cgi/trace")).text();
    return { country: /^loc=([A-Z]{2})$/m.exec(text)?.[1] ?? null };
  },
];

function countryFromBrowser(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz];
  } catch {
    /* ignore */
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = /[-_]([A-Z]{2})\b/.exec(lang ?? "")?.[1];
    if (region && COUNTRY_CURRENCY[region]) return region;
  }
  return null;
}

async function detectGeo(): Promise<VisitorGeo> {
  for (const provider of GEO_PROVIDERS) {
    try {
      const geo = await provider();
      const code = geo.country?.toUpperCase();
      if (code && /^[A-Z]{2}$/.test(code) && code !== "XX") return { country: code, region: geo.region ?? null, city: geo.city ?? null };
    } catch {
      /* try the next provider */
    }
  }
  return { country: countryFromBrowser(), region: null, city: null };
}

async function fetchUsdRate(code: string): Promise<number | null> {
  if (code === "USD") return 1;
  try {
    const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", 5000);
    if (!res.ok) return null;
    const rate = (await res.json())?.rates?.[code];
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (Date.now() - parsed.ts > CACHE_TTL_MS || !parsed.currency?.code || !parsed.geo) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(value: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

async function resolveLocal(): Promise<{ geo: VisitorGeo; currency: Currency }> {
  const cached = readCache();
  if (cached) return cached;

  const geo = await detectGeo();
  const code = (geo.country && COUNTRY_CURRENCY[geo.country]) || "USD";
  const rate = await fetchUsdRate(code);
  const currency = rate ? { code, symbol: symbolFor(code), rate } : USD;

  // Only cache a successful conversion, so a flaky FX call is retried next visit
  if (rate) writeCache({ geo, currency, ts: Date.now() });
  return { geo, currency };
}

let detection: Promise<{ geo: VisitorGeo; currency: Currency }> | null = null;

function detect() {
  detection ??= resolveLocal();
  return detection;
}

/** Visitor's approximate location — shares the single lookup used for currency. */
export async function getVisitorGeo(): Promise<VisitorGeo> {
  try {
    return (await detect()).geo;
  } catch {
    return { country: null, region: null, city: null };
  }
}

// ─── Shared store ─────────────────────────────────────────────────────────────

type State = {
  status: "idle" | "loading" | "ready";
  country: string | null;
  local: Currency;
  preference: CurrencyPreference;
};

let state: State = { status: "idle", country: null, local: USD, preference: "local" };
const SERVER_STATE = state;
const listeners = new Set<() => void>();

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function start() {
  if (state.status !== "idle") return;
  let preference: CurrencyPreference = "local";
  try {
    if (localStorage.getItem(PREF_KEY) === "USD") preference = "USD";
  } catch {
    /* ignore */
  }
  setState({ status: "loading", preference });
  detect()
    .then(({ geo, currency }) => setState({ status: "ready", country: geo.country, local: currency }))
    .catch(() => setState({ status: "ready" }));
}

export function setCurrencyPreference(preference: CurrencyPreference) {
  try {
    localStorage.setItem(PREF_KEY, preference);
  } catch {
    /* ignore */
  }
  setState({ preference });
}

export function useCurrency() {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  useEffect(start, []);
  return {
    /** Currency to display, honouring the visitor's USD/local toggle */
    currency: s.preference === "USD" ? USD : s.local,
    local: s.local,
    country: s.country,
    preference: s.preference,
    ready: s.status === "ready",
    setPreference: setCurrencyPreference,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** USD shows exact cents; converted currencies round up to whole units. */
export function formatPrice(usdCents: number, currency: Currency): string {
  if (currency.code === "USD") {
    const dollars = usdCents / 100;
    return `$${dollars.toLocaleString("en-US", {
      minimumFractionDigits: usdCents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const amount = Math.ceil((usdCents / 100) * currency.rate);
  return `${currency.symbol}${amount.toLocaleString("en-US")}`;
}

export function formatUsd(usdCents: number): string {
  return formatPrice(usdCents, USD);
}
