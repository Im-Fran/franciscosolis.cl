import {CMS_ROUTE} from "@/lib/cms/config.ts";

/**
 * Where the Standalone App Pages service lives, and where its two interfaces sit in this site.
 *
 * Unlike the CMS and the auth service, this one is **not** a client application of its own. Its
 * editor is a section of the CMS interface, signed in under `franciscosolis-cms`, so there is no
 * client id, no redirect URI and no storage namespace here — only a base URL. The service accepts
 * the CMS's audience precisely so this file can stay this short.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const PAGES_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_PAGES_BASE_URL ?? "https://api.franciscosolis.cl/pages",
);

/** Base path of the public product pages inside this site. */
export const APPLICATION_ROUTE = "/application";

/**
 * The public address of an application and of each of its tabs.
 *
 * Every tab is a route rather than a piece of component state: a visitor linking somebody to a
 * changelog entry or to a wiki page is the normal case for this kind of page, and a tab bar that
 * cannot be linked to is a worse version of the navigation it stands in for.
 */
export const applicationRoute = {
  overview: (slug: string) => `${APPLICATION_ROUTE}/${slug}`,
  updates: (slug: string) => `${APPLICATION_ROUTE}/${slug}/updates`,
  wiki: (slug: string) => `${APPLICATION_ROUTE}/${slug}/wiki`,
  wikiPage: (slug: string, page: string) => `${APPLICATION_ROUTE}/${slug}/wiki/${page}`,
  contact: (slug: string) => `${APPLICATION_ROUTE}/${slug}/contact`,
} as const;

/** Base path of the editorial screens, which live inside the CMS interface. */
export const PAGES_ADMIN_ROUTE = `${CMS_ROUTE}/pages`;

/** Where the editorial sections live. Kept here so a link and its route cannot drift apart. */
export const pagesRoute = {
  list: PAGES_ADMIN_ROUTE,
  new: `${PAGES_ADMIN_ROUTE}/new`,
  item: (id: string) => `${PAGES_ADMIN_ROUTE}/${id}`,
  updates: (id: string) => `${PAGES_ADMIN_ROUTE}/${id}/updates`,
  updateNew: (id: string) => `${PAGES_ADMIN_ROUTE}/${id}/updates/new`,
  updateItem: (id: string, updateId: string) => `${PAGES_ADMIN_ROUTE}/${id}/updates/${updateId}`,
  wiki: (id: string) => `${PAGES_ADMIN_ROUTE}/${id}/wiki`,
  wikiNew: (id: string) => `${PAGES_ADMIN_ROUTE}/${id}/wiki/new`,
  wikiItem: (id: string, pageId: string) => `${PAGES_ADMIN_ROUTE}/${id}/wiki/${pageId}`,
} as const;
