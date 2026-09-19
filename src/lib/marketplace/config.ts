import {CMS_ROUTE} from "@/lib/cms/config.ts";

/**
 * Where the marketplace service lives, and where its two interfaces sit in this site.
 *
 * Unlike the CMS and the auth service, this one is **not** a client application of its own on this
 * side. Its editor is a section of the CMS interface, signed in under `franciscosolis-cms`, so
 * there is no client id, no redirect URI and no storage namespace here — only a base URL. The
 * service accepts the CMS's audience precisely so this file can stay this short.
 *
 * The buying half is signed in under the *site's* own client id (`franciscosolis-web`), which the
 * service accepts on a second audience list with no domain gate: anybody may buy, and anybody who
 * bought may review.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const MARKETPLACE_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_MARKETPLACE_BASE_URL ?? "https://api.franciscosolis.cl/marketplace",
);

/** Base path of the public product pages inside this site. */
export const PRODUCT_ROUTE = "/product";

/**
 * The address this section used to live at, kept as a redirect.
 *
 * `/application/:slug` was the public address of every product page until the store landed, and it
 * is the one a published `README`, a store listing or somebody's bookmark still points at. A rename
 * that turns those into 404s is a rename that costs traffic for nothing, so the old path stays as a
 * redirect onto the new one rather than as a second copy of the section.
 */
export const LEGACY_PRODUCT_ROUTE = "/application";

/**
 * The public address of a product and of each of its tabs.
 *
 * Every tab is a route rather than a piece of component state: a visitor linking somebody to a
 * changelog entry, one wiki page or a single review is the normal case for this kind of page, and a
 * tab bar that cannot be linked to is a worse version of the navigation it stands in for.
 *
 * A release carries **both** its channel and its version, because neither identifies it alone: the
 * channel is part of the version key on the service, so `1.4.0` can exist as an `rc` and, a week
 * later, as a `release`, and a URL naming only the number would be ambiguous between the two.
 */
export const productRoute = {
  overview: (slug: string) => `${PRODUCT_ROUTE}/${slug}`,
  releases: (slug: string) => `${PRODUCT_ROUTE}/${slug}/releases`,
  release: (slug: string, channel: string, version: string) =>
    `${PRODUCT_ROUTE}/${slug}/releases/${encodeURIComponent(channel)}/${encodeURIComponent(version)}`,
  wiki: (slug: string) => `${PRODUCT_ROUTE}/${slug}/wiki`,
  wikiPage: (slug: string, page: string) => `${PRODUCT_ROUTE}/${slug}/wiki/${page}`,
  reviews: (slug: string) => `${PRODUCT_ROUTE}/${slug}/reviews`,
  contact: (slug: string) => `${PRODUCT_ROUTE}/${slug}/contact`,
} as const;

/** Base path of the editorial screens, which live inside the CMS interface. */
export const MARKETPLACE_ADMIN_ROUTE = `${CMS_ROUTE}/marketplace`;

/** Where the editorial sections live. Kept here so a link and its route cannot drift apart. */
export const marketplaceRoute = {
  list: MARKETPLACE_ADMIN_ROUTE,
  new: `${MARKETPLACE_ADMIN_ROUTE}/new`,
  item: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}`,
  releases: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/releases`,
  releaseNew: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/releases/new`,
  releaseItem: (id: string, releaseId: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/releases/${releaseId}`,
  wiki: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/wiki`,
  wikiNew: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/wiki/new`,
  wikiItem: (id: string, pageId: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/wiki/${pageId}`,
  /**
   * The sales of one product: its payments, its receipts and its refunds.
   *
   * Nested under the product like every other section, because that is how the service exposes
   * it — a sale is read, refunded and receipted through its own product's URL and no other's.
   * There is no public counterpart: nothing in `productRoute` above corresponds to these, and the
   * public tabs are unchanged. A page's shape is a house standard; this is a back office.
   */
  sales: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/sales`,
  saleItem: (id: string, saleId: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/sales/${saleId}`,
  vouchers: (id: string) => `${MARKETPLACE_ADMIN_ROUTE}/${id}/vouchers`,
} as const;
