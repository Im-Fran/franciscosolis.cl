import {AUTH_BASE_URL, AUTH_SCOPE} from "@/lib/auth/config.ts";
import type {AuthClientConfig} from "@/lib/auth/config.ts";

/**
 * Where the support API lives, and how the two halves of this section identify themselves.
 *
 * There are two halves, and they are deliberately not the same thing:
 *
 * - The **help centre and the ticket views** are public. Anybody can read an article, open a ticket
 *   and follow it with the secret in the link they were emailed. None of that touches an OAuth
 *   client, which is why `content.ts` is built on the bare HTTP client and imports nothing from
 *   here but the base URL.
 * - The **support console** at `/support` is a client application of its own, `franciscosolis-support`.
 *   Unlike the standalone app pages — which reuse the CMS's audience precisely because their editor
 *   *is* the CMS — a support agent is a different person from a content editor, and tickets are
 *   assignable, which only means anything if there is a defined set of people to assign them to.
 *   The auth service resolves roles per application, so a client id of its own is the mechanism that
 *   produces that set.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const SUPPORT_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_SUPPORT_BASE_URL ?? "https://api.franciscosolis.cl/support",
);

export const SUPPORT_CLIENT_ID = import.meta.env.VITE_SUPPORT_CLIENT_ID ?? "franciscosolis-support";

/** The support team's console. */
export const SUPPORT_ROUTE = "/support";
export const SUPPORT_SIGN_IN_ROUTE = `${SUPPORT_ROUTE}/sign-in`;
export const SUPPORT_CALLBACK_ROUTE = `${SUPPORT_ROUTE}/callback`;

/** The public help centre, and the ticket views people reach from their email. */
export const HELP_ROUTE = "/help";
export const TICKETS_ROUTE = "/tickets";

/**
 * Redirect URI the console asks for. It matches `SUPPORT_CALLBACK_ROUTE`, which is the whole point:
 * the auth service compares redirect URIs byte for byte, so the registered value and the route this
 * site actually serves have to be the same string. `apps/auth/migrations/0010_support_application.sql`
 * registers exactly this, and `test/functional/seeded-clients.test.ts` over there fails if the two
 * ever drift apart.
 */
export const SUPPORT_REDIRECT_PATH = import.meta.env.VITE_SUPPORT_REDIRECT_PATH ?? SUPPORT_CALLBACK_ROUTE;

/** Every address in this section, in one place, so a link and its route cannot drift apart. */
export const supportRoute = {
  inbox: SUPPORT_ROUTE,
  ticket: (id: string) => `${SUPPORT_ROUTE}/tickets/${id}`,
  labels: `${SUPPORT_ROUTE}/labels`,
  articles: `${SUPPORT_ROUTE}/help`,
  articleNew: `${SUPPORT_ROUTE}/help/new`,
  article: (id: string) => `${SUPPORT_ROUTE}/help/${id}`,
  categories: `${SUPPORT_ROUTE}/help/categories`,
  emails: `${SUPPORT_ROUTE}/emails`,
  audit: `${SUPPORT_ROUTE}/audit`,
} as const;

export const helpRoute = {
  home: HELP_ROUTE,
  search: (query: string) => `${HELP_ROUTE}/search?q=${encodeURIComponent(query)}`,
  category: (slug: string) => `${HELP_ROUTE}/c/${encodeURIComponent(slug)}`,
  article: (slug: string) => `${HELP_ROUTE}/a/${encodeURIComponent(slug)}`,
  newTicket: `${HELP_ROUTE}/new`,
  ticket: (reference: string) => `${TICKETS_ROUTE}/${encodeURIComponent(reference)}`,
  myTickets: "/account/tickets",
} as const;

/**
 * Its own storage namespace, so signing out of the support console leaves the site's session and
 * the CMS's alone. Three sessions can be live in one browser and none of them knows about the
 * others.
 */
export const SUPPORT_AUTH_CONFIG: AuthClientConfig = {
  storageNamespace: "fs.support",
  clientId: SUPPORT_CLIENT_ID,
  baseUrl: AUTH_BASE_URL,
  scope: AUTH_SCOPE,
  signInRoute: SUPPORT_SIGN_IN_ROUTE,
  callbackRoute: SUPPORT_CALLBACK_ROUTE,
  redirectPath: SUPPORT_REDIRECT_PATH,
  defaultReturnTo: SUPPORT_ROUTE,
  returnToPrefix: SUPPORT_ROUTE,
};
