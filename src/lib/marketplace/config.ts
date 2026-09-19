import {AUTH_BASE_URL, AUTH_SCOPE} from "@/lib/auth/config.ts";
import type {AuthClientConfig} from "@/lib/auth/config.ts";

/**
 * Where the marketplace service lives, and how the three halves of this section identify themselves.
 *
 * Three, and they are deliberately not the same thing:
 *
 * - The **product pages** at `/product/<slug>` are public. Nothing there touches an OAuth client,
 *   which is why `content.ts` is built on the bare HTTP client and imports nothing from here but
 *   the base URL.
 * - **Buying and reviewing** are signed in under the *site's* own client id (`franciscosolis-web`),
 *   which the service accepts on a second audience list with no domain gate at all: anybody may
 *   buy, and anybody who bought may review.
 * - The **console** at `/marketplace` is a client application of its own,
 *   `franciscosolis-marketplace`.
 *
 * That last one is worth stating plainly, because getting it wrong is what broke this section once
 * already. Unlike `apps/pages` before it — whose editor lived inside the CMS precisely because the
 * service accepted the CMS's audience — `apps/marketplace` accepts **only its own**
 * (`MARKETPLACE_ALLOWED_AUDIENCES`). A console signing in under `franciscosolis-cms` gets a token
 * the service refuses with a 401 *before* it ever looks at the permission, which reads on this side
 * as an expired session and sends the editor around the sign-in loop forever.
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

export const MARKETPLACE_CLIENT_ID =
  import.meta.env.VITE_MARKETPLACE_CLIENT_ID ?? "franciscosolis-marketplace";

/** Base path of the editorial console, which is its own section of this site. */
export const MARKETPLACE_ADMIN_ROUTE = "/marketplace";
export const MARKETPLACE_SIGN_IN_ROUTE = `${MARKETPLACE_ADMIN_ROUTE}/sign-in`;
export const MARKETPLACE_CALLBACK_ROUTE = `${MARKETPLACE_ADMIN_ROUTE}/callback`;

/**
 * The address the console lived at before it had a client application of its own, kept as a
 * redirect. `/cms/pages` came before that one, and both still land here.
 */
export const LEGACY_ADMIN_ROUTES = ["marketplace", "pages"] as const;

/**
 * Redirect URI the console asks for. It matches `MARKETPLACE_CALLBACK_ROUTE`, which is the whole
 * point: the auth service compares redirect URIs byte for byte, so the registered value and the
 * route this site actually serves have to be the same string.
 */
export const MARKETPLACE_REDIRECT_PATH =
  import.meta.env.VITE_MARKETPLACE_REDIRECT_PATH ?? MARKETPLACE_CALLBACK_ROUTE;

/**
 * Its own storage namespace, so signing out of the marketplace console leaves the site's session
 * and the CMS's alone. Several sessions can be live in one browser and none of them knows about
 * the others.
 */
export const MARKETPLACE_AUTH_CONFIG: AuthClientConfig = {
  storageNamespace: "fs.marketplace",
  clientId: MARKETPLACE_CLIENT_ID,
  baseUrl: AUTH_BASE_URL,
  scope: AUTH_SCOPE,
  signInRoute: MARKETPLACE_SIGN_IN_ROUTE,
  callbackRoute: MARKETPLACE_CALLBACK_ROUTE,
  redirectPath: MARKETPLACE_REDIRECT_PATH,
  defaultReturnTo: MARKETPLACE_ADMIN_ROUTE,
  returnToPrefix: MARKETPLACE_ADMIN_ROUTE,
};

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
