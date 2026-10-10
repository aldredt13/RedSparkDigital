# Changelog

All notable changes to the RedSpark Digital website. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/):

- **MAJOR** — changes that need action before or during deploy (environment variables,
  database SQL that must run first, removed features).
- **MINOR** — new features that are backwards compatible.
- **PATCH** — bug fixes, copy tweaks, dependency/security updates.

The current version is shown at the bottom of the admin sidebar and on the admin login page.

**Releasing:** add the changes under a new version heading here, then run
`npm version <major|minor|patch>` (bumps `package.json`, commits, and creates the
`vX.Y.Z` git tag) and `git push --follow-tags`.

---

## [2.3.0] — 2026-10-10

### Added
- **Visitors grouped by IP address** in Analytics — one row per IP with every device/browser it used (and visits per device), its network (ISP) name, and how many browsers share it. Clicking an IP shows its full history across devices. CSV export updated.
- **Bot filtering** — the visitor's network name is now recorded; traffic from cloud, hosting and VPN-host networks (link scanners, crawlers) is flagged as a bot and hidden by default, with a "Hide bots" switch and a count of hidden bot visits. Older visits get their network looked up automatically when the dashboard opens.
- **"Don't track me"** — exclude IP addresses from analytics entirely (blocked in the database, past visits deleted): one-click "Exclude my IP", a managed list, and "Don't track this IP" from an IP's history. Plus the existing per-browser switch.
- Networks (ISP) tab under Locations.
- Search engine verification without code changes: set `VITE_GOOGLE_SITE_VERIFICATION` / `VITE_BING_SITE_VERIFICATION` in Vercel.

### Changed — SEO & speed
- Live content (contact details, social links, packages, projects, reviews) is fetched at build time and baked into the prerendered HTML and structured data — search engines and link previews see real content, packages are listed as priced offers, and visitors no longer see a loading flash. Fresh data still loads in the browser.
- Fonts are self-hosted and preloaded (no Google Fonts request).
- Hero image converted to responsive WebP (136 KB → 17 KB on phones / 40 KB on desktop); logo 60 KB → 3 KB.
- The pricing section no longer shows an error when the live fetch fails but packages are available.
- Privacy policy updated: internet-provider name is collected for bot filtering; Google Fonts removed from third parties.

### Database
- Run `supabase/sql/03_analytics_ip_grouping.sql` (after 01 and 02). The dashboard works without it, but then groups only the top 100 browsers by IP and can't filter bots or exclude IPs.

## [2.2.0] — 2026-10-08

### Added
- **Privacy policy** page at `/privacy`: what's collected (contact form, visit statistics incl. IP and approximate location), why, who it's shared with (Supabase, Vercel, Discord, Google Fonts, location/exchange-rate services), browser storage used (no cookies), retention, and visitors' rights.
- Visitors can **opt out of analytics** on the privacy page (also forgets their analytics ID), or copy their analytics ID to request deletion.
- "Privacy policy" link in the footer and under the contact form.

### Changed
- The privacy page is prerendered to `privacy.html` with its own title, description and canonical URL, and listed in `sitemap.xml`.
- Stopped tracking the TanStack Router plugin's temp folder (`.tanstack/`) in git.
- The build now stops with a clear message if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or renamed (Vite only exposes `VITE_`-prefixed variables). Added `.env.example` documenting the required names.

## [2.1.0] — 2026-10-08

### Added
- **Website analytics** — new *Analytics* tab in the admin dashboard:
  - Traffic over time (visitors, page views, visits, enquiries) with comparison to the previous period, plus a table view.
  - KPI tiles with growth vs the previous period: visitors (new vs returning), page views, average time on site, engagement rate, enquiries and conversion rate, contact clicks.
  - Traffic sources (Google, Facebook, Instagram, WhatsApp, direct…) and UTM campaigns.
  - Visitor locations by country and city; devices, browsers and operating systems.
  - How far visitors scroll (reach per section), actions taken (WhatsApp/phone/email clicks, package buttons, FAQ opens…), service & package interest vs enquiries.
  - "When visitors come" heatmap by weekday and hour.
  - Live activity: who's on the site now and what they did in the last 30 minutes.
  - Visitors table with friendly names, location, device, IP address, visits and time on site; click a visitor for their full visit history, or "forget" them for privacy requests. CSV export.
  - "Count my own visits" toggle — admins' browsers are excluded by default.
- Overview: 7-day visitors tile with trend, and an analytics item in the setup checklist.
- Version number shown in the admin sidebar and login page.

### Changed
- Location lookup now returns region and city as well as country (still a single request, shared by currency and analytics).

### Security
- Removed the unused `@tanstack/react-start` dependency (CVE-2026-102989 — blocked Vercel deploys) and the unused `@cloudflare/vite-plugin`.
- Updated dependencies to clear all `npm audit` findings (including critical `seroval` and high-severity `vite`, `ws`, `postcss` issues).

### Database
- Run `supabase/sql/02_analytics.sql` (after `01_security_and_notifications.sql`). The site works without it; the Analytics tab shows setup instructions until it's run.

### Privacy
- Visitors get a random ID stored in their browser (no cookies, no third-party trackers). IPs are captured server-side, cleared after 90 days; events are deleted after 13 months. Bots and browsers sending Do Not Track / Global Privacy Control are not tracked.

## [2.0.0] — 2026-10-08

### ⚠ Action required
- Run `supabase/sql/01_security_and_notifications.sql`, then set `VITE_SUPABASE_ANON_KEY` (Vercel + `.env`) to the **anon/publishable** key and redeploy. The build now refuses to run with a service-role key.
- Contact-form Discord alerts are now sent by the database, so they need the SQL above.

### Security
- The service-role key had been shipped in the public bundle and git history — replaced by a build-time guard; rotate the old key.
- Rebuilt row-level security: admin allowlist (`is_admin()`), public read limited to what the site shows, Discord webhook no longer readable by visitors, contact form rate limit, definer view fixed.

### Added
- Admin: Overview page, sign out, confirm dialogs, toasts, live previews, image uploads, reordering, bulk actions, CSV export, search/filters, submission drawer with reply/WhatsApp shortcuts.
- Contact form works with pricing packages and custom packages (pre-selected from Pricing), with local-currency prices.
- FAQ section, floating WhatsApp button, mobile navigation menu.
- SEO: correct canonical/Open Graph URLs, sitemap.xml, robots.txt, prerendered landing page, structured data, OG image, noindex on admin, real 404 page.

### Fixed
- Geolocation/currency detection (the HTTP-only provider always failed on HTTPS, so everyone saw USD).
- Fonts never loaded; invalid colour values in the admin and form focus states; anchored sections hidden under the navbar; empty contact submits silently ignored; phone link dialling the WhatsApp number.

## [1.0.0] — 2026-05-04

- Initial version of the site as handed over (commit `c222c92`).
