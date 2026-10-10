// Injects server-rendered pages into the built HTML. Runs after `vite build`
// (which also writes dist/app.html, the shell used for /admin).
//   dist/index.html   ← landing page
//   dist/privacy.html ← privacy policy (served at /privacy via vercel.json)
//
// The live site content (contact details, packages, projects, reviews) is
// fetched from Supabase at build time and baked into the HTML + structured
// data, so search engines and link previews see real content. If Supabase is
// unreachable the build still succeeds with the built-in defaults.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

const dist = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");

if (!template.includes('<div id="root"></div>')) throw new Error("prerender: #root placeholder not found in dist/index.html");

// ─── Fetch public content ────────────────────────────────────────────────────

const env = loadEnv(process.env.NODE_ENV === "development" ? "development" : "production", process.cwd(), "VITE_");
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY ?? "";
const PUBLIC_KEYS = [
  "contact_email", "contact_phone", "contact_phone_raw", "business_location", "business_hours",
  "social_twitter", "social_instagram", "social_github", "social_facebook", "social_linkedin",
];

async function rest(query) {
  if (!SUPABASE_URL || !KEY) throw new Error("Supabase env vars missing");
  const headers = { apikey: KEY, Accept: "application/json" };
  if (KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 200));
  return res.json();
}

const [settingsRows, plans, projects, testimonials] = await Promise.all([
  rest(`site_settings?select=key,value&key=in.(${PUBLIC_KEYS.join(",")})`),
  rest("pricing_plans_full?select=*&order=sort_order"),
  rest("portfolio_projects?select=*&order=sort_order"),
  rest("testimonials?select=*&order=created_at.desc"),
].map((p) => p.catch((e) => (console.warn(`prerender: couldn't fetch content (${e.message}) — using defaults`), null))));

const data = {};
if (settingsRows) data.site = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
if (plans) data.plans = plans.map((p) => ({ ...p, features: p.features ?? [] }));
if (projects) data.projects = projects;
if (testimonials) data.testimonials = testimonials;

// ─── Structured data from real content ───────────────────────────────────────

function withStructuredData(html) {
  const re = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  const match = re.exec(html);
  if (!match) return html;
  const ld = JSON.parse(match[2]);
  const business = ld["@graph"]?.find((n) => n["@type"] === "LocalBusiness");
  if (business) {
    const site = data.site ?? {};
    if (site.contact_email?.trim()) business.email = site.contact_email.trim();
    const phone = (site.contact_phone || site.contact_phone_raw || "").replace(/[^\d+]/g, "");
    if (phone) business.telephone = phone.startsWith("+") ? phone : `+${phone}`;
    const sameAs = PUBLIC_KEYS.filter((k) => k.startsWith("social_")).map((k) => site[k]?.trim()).filter(Boolean);
    if (sameAs.length) business.sameAs = sameAs;
    if (data.plans?.length && business.hasOfferCatalog) {
      business.hasOfferCatalog.itemListElement.push(
        ...data.plans.map((p) => ({
          "@type": "Offer",
          name: p.name,
          description: [p.description, ...(p.features ?? [])].filter(Boolean).join(" · "),
          price: (p.price_usd_cents / 100).toFixed(2),
          priceCurrency: "USD",
          priceSpecification: { "@type": "PriceSpecification", minPrice: (p.price_usd_cents / 100).toFixed(2), priceCurrency: "USD" },
          itemOffered: { "@type": "Service", name: p.name },
        })),
      );
    }
    // Reviews are deliberately not marked up: Google treats a business's own
    // reviews as "self-serving" and won't show them in results.
  }
  const json = JSON.stringify(ld, null, 2).replace(/</g, "\\u003c");
  return html.replace(re, (_, open, _body, close) => `${open}\n${json}\n    ${close}`);
}

// ─── Render ──────────────────────────────────────────────────────────────────

// Preload the Latin font files used above the fold, so headings don't swap fonts after load
const assets = await fs.readdir(path.join(dist, "assets"));
const fontPreloads = assets
  .filter((f) => /^(inter|space-grotesk)-latin-wght-normal-.*\.woff2$/.test(f))
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin />`)
  .join("\n    ");

const { render, renderPrivacy } = await import(pathToFileURL(path.join(ssrDir, "entry-prerender.js")).href);
const dataScript = `<script>window.__RSD_DATA__=${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
const inject = (html, markup) =>
  html
    .replace("</head>", `  ${fontPreloads}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>${dataScript}`);

const landing = render(data);
await fs.writeFile(path.join(dist, "index.html"), inject(withStructuredData(template), landing));

const privacyTitle = "Privacy Policy | RedSpark Digital";
const privacyDescription = "How RedSpark Digital collects, uses and protects your information, and the choices you have.";
const privacyShell = template
  .replace(/<title>[^<]*<\/title>/, `<title>${privacyTitle}</title>`)
  .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${privacyDescription}$2`)
  .replace(/(<link rel="canonical" href="[^"]*?)\/?"/, '$1/privacy"')
  .replace(/(<meta property="og:url"\s+content="[^"]*?)\/?"/, '$1/privacy"')
  .replace(/(<meta property="og:title"\s+content=")[^"]*(")/, `$1${privacyTitle}$2`)
  .replace(/(<meta property="og:description"\s+content=")[^"]*(")/, `$1${privacyDescription}$2`)
  .replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/, `$1${privacyTitle}$2`)
  .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/, `$1${privacyDescription}$2`)
  // The business data belongs to the homepage
  .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
const privacy = renderPrivacy(data);
await fs.writeFile(path.join(dist, "privacy.html"), inject(privacyShell, privacy));

await fs.rm(ssrDir, { recursive: true, force: true });

const counts = [`${data.plans?.length ?? 0} plans`, `${data.projects?.length ?? 0} projects`, `${data.testimonials?.length ?? 0} reviews`].join(", ");
console.log(`prerender: landing (${(landing.length / 1024).toFixed(1)} KB, ${counts}) and privacy (${(privacy.length / 1024).toFixed(1)} KB) pages rendered`);
