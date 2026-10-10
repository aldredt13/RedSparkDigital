/**
 * Content baked into the page at build time (scripts/prerender.mjs) so the
 * prerendered HTML — what search engines and link previews read — contains the
 * real contact details, packages, projects and reviews, and so visitors see them
 * without a loading flash. Components still fetch fresh data after load.
 */

export type InitialData = {
  /** Public site_settings as key → value */
  site?: Record<string, string>;
  plans?: unknown[];
  projects?: unknown[];
  testimonials?: unknown[];
};

declare global {
  interface Window {
    __RSD_DATA__?: InitialData;
  }
}

let serverData: InitialData = {};

/** Build-time only: set before rendering a page to HTML. */
export function setServerData(data: InitialData) {
  serverData = data;
}

export function initialData(): InitialData {
  if (typeof window !== "undefined") return window.__RSD_DATA__ ?? {};
  return serverData;
}
