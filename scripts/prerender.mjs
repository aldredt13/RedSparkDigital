// Injects the server-rendered landing page into dist/index.html. Runs after
// `vite build` (which also writes dist/app.html, the shell used for /admin).
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const ssrDir = path.resolve("dist-ssr");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");

if (!template.includes('<div id="root"></div>')) throw new Error("prerender: #root placeholder not found in dist/index.html");

const { render } = await import(pathToFileURL(path.join(ssrDir, "entry-prerender.js")).href);
const html = render();
await fs.writeFile(path.join(dist, "index.html"), template.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
await fs.rm(ssrDir, { recursive: true, force: true });

console.log(`prerender: landing page rendered (${(html.length / 1024).toFixed(1)} KB of HTML)`);
