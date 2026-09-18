import {lazy} from "react";

/*
 * A product page renders Markdown, which means a parser and a sanitizer — around 25 kB gzipped that
 * every visitor of the landing page would otherwise download to read a page most of them never
 * open. Same reasoning as `/legal` and the console screens, so the same treatment.
 */

export const ApplicationLayout = lazy(() =>
  import("@/pages/application/application-layout.tsx").then((m) => ({default: m.ApplicationLayout})),
);
export const ApplicationOverview = lazy(() =>
  import("@/pages/application/overview.tsx").then((m) => ({default: m.ApplicationOverview})),
);
export const ApplicationUpdates = lazy(() =>
  import("@/pages/application/updates.tsx").then((m) => ({default: m.ApplicationUpdates})),
);
export const ApplicationWiki = lazy(() =>
  import("@/pages/application/wiki.tsx").then((m) => ({default: m.ApplicationWiki})),
);
export const ApplicationContact = lazy(() =>
  import("@/pages/application/contact.tsx").then((m) => ({default: m.ApplicationContact})),
);
