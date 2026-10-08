// Injects server-rendered pages into the built HTML. Runs after `vite build`
// (which also writes dist/app.html, the shell used for /admin).
//   dist/index.html   ← landing page
//   dist/privacy.html ← privacy policy (served at /privacy via vercel.json)
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");

if (!template.includes('<div id="root"></div>')) throw new Error("prerender: #root placeholder not found in dist/index.html");

const { render, renderPrivacy } = await import(pathToFileURL(path.join(ssrDir, "entry-prerender.js")).href);
const inject = (html, markup) => html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);

const landing = render();
await fs.writeFile(path.join(dist, "index.html"), inject(template, landing));

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
  .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/, `$1${privacyDescription}$2`);
const privacy = renderPrivacy();
await fs.writeFile(path.join(dist, "privacy.html"), inject(privacyShell, privacy));

await fs.rm(ssrDir, { recursive: true, force: true });

console.log(`prerender: landing (${(landing.length / 1024).toFixed(1)} KB) and privacy (${(privacy.length / 1024).toFixed(1)} KB) pages rendered`);
