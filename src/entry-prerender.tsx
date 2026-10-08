// Build-time only: renders public pages to static HTML so search engines and
// link previews see real content before any JavaScript runs (scripts/prerender.mjs).
import { renderToString } from "react-dom/server";
import { LandingPage } from "./components/site/LandingPage";
import { PrivacyPage } from "./components/site/PrivacyPage";

export function render(): string {
  return renderToString(<LandingPage />);
}

export function renderPrivacy(): string {
  return renderToString(<PrivacyPage />);
}
