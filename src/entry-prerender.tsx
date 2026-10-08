// Build-time only: renders the landing page to static HTML so search engines and
// link previews see real content before any JavaScript runs (scripts/prerender.mjs).
import { renderToString } from "react-dom/server";
import { LandingPage } from "./components/site/LandingPage";

export function render(): string {
  return renderToString(<LandingPage />);
}
