// Build-time only: renders public pages to static HTML so search engines and
// link previews see real content before any JavaScript runs (scripts/prerender.mjs).
import { renderToString } from "react-dom/server";
import { LandingPage } from "./components/site/LandingPage";
import { PrivacyPage } from "./components/site/PrivacyPage";
import { setServerData, type InitialData } from "./lib/initial-data";

export function render(data: InitialData = {}): string {
  setServerData(data);
  return renderToString(<LandingPage />);
}

export function renderPrivacy(data: InitialData = {}): string {
  setServerData(data);
  return renderToString(<PrivacyPage />);
}
