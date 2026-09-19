import {lazy} from "react";

/*
 * A product page renders Markdown, which means a parser and a sanitizer — around 25 kB gzipped that
 * every visitor of the landing page would otherwise download to read a page most of them never
 * open. Same reasoning as `/legal` and the console screens, so the same treatment.
 */

export const ProductLayout = lazy(() =>
  import("@/pages/product/product-layout.tsx").then((m) => ({default: m.ProductLayout})),
);
export const ProductOverview = lazy(() =>
  import("@/pages/product/overview.tsx").then((m) => ({default: m.ProductOverview})),
);
export const ProductReleases = lazy(() =>
  import("@/pages/product/releases.tsx").then((m) => ({default: m.ProductReleases})),
);
export const ProductReleaseDetail = lazy(() =>
  import("@/pages/product/release-detail.tsx").then((m) => ({default: m.ProductReleaseDetail})),
);
export const ProductWiki = lazy(() =>
  import("@/pages/product/wiki.tsx").then((m) => ({default: m.ProductWiki})),
);
export const ProductReviews = lazy(() =>
  import("@/pages/product/reviews.tsx").then((m) => ({default: m.ProductReviews})),
);
export const ProductContact = lazy(() =>
  import("@/pages/product/contact.tsx").then((m) => ({default: m.ProductContact})),
);
