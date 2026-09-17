import {AUTH_BASE_URL, AUTH_SCOPE} from "@/lib/auth/config.ts";
import type {AuthClientConfig} from "@/lib/auth/config.ts";

/**
 * Where the CMS API lives and how the CMS interface identifies itself to the auth service.
 *
 * The CMS is a client application of its own: it signs in at the same issuer as the rest of the
 * site but under `franciscosolis-cms`, so the access token it receives carries the roles and
 * permissions granted *for the CMS* — which is exactly what `/cms/admin/*` checks.
 *
 * It is a client in the full sense, single sign-on included: it collects no credentials itself but
 * starts an authorization code request at `/auth`'s `GET /oauth/authorize` and lets the service's
 * hosted screen authenticate the user. `CMS_SIGN_IN_ROUTE` below is only where that hand-off is
 * kicked off from; the screen it renders is a spinner, not a form.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const CMS_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_CMS_BASE_URL ?? "https://api.franciscosolis.cl/cms",
);

export const CMS_CLIENT_ID = import.meta.env.VITE_CMS_CLIENT_ID ?? "franciscosolis-cms";

/** Base path of the CMS interface inside this site. */
export const CMS_ROUTE = "/cms";

/**
 * Where the gate sends anonymous visitors, and where the callback's retry points. Not a sign-in
 * screen any more — it starts the hosted flow and waits, keeping `?return_to=` across the trip.
 */
export const CMS_SIGN_IN_ROUTE = `${CMS_ROUTE}/sign-in`;
export const CMS_CALLBACK_ROUTE = `${CMS_ROUTE}/callback`;

/** Where the interface answered before it moved off `/apps/cms`; `router.tsx` still forwards it. */
export const CMS_LEGACY_ROUTE = "/apps/cms";

/**
 * Redirect URI the CMS asks the auth service to send the browser back to.
 *
 * It is deliberately *not* `CMS_CALLBACK_ROUTE`. The application is still registered under the
 * pre-move `/apps/cms/callback`, and the authorization server matches redirect URIs by exact
 * string: asking for the new path is refused outright — `400 redirect_uri is not registered for
 * this client` — on every entry point, before any redirect this site could forward can happen.
 * Quoting the registered path instead lands the browser on `/apps/cms/callback`, which
 * `router.tsx` forwards to the callback screen with the code and state intact, and the exchange
 * quotes the same registered value because it reads this config rather than the address bar.
 *
 * Once the application carries `<origin>/cms/callback` among its redirect URIs — Admin →
 * Applications in the auth interface — set `VITE_CMS_REDIRECT_PATH=/cms/callback` (or change the
 * default here) and the extra hop disappears.
 */
export const CMS_REDIRECT_PATH =
  import.meta.env.VITE_CMS_REDIRECT_PATH ?? `${CMS_LEGACY_ROUTE}/callback`;

/**
 * Where the interface's own sections live. Kept here rather than spelled out at each call site so
 * a link and the route it points at cannot drift apart.
 */
export const cmsRoute = {
  overview: CMS_ROUTE,
  content: (collection: string) => `${CMS_ROUTE}/content/${collection}`,
  contentNew: (collection: string) => `${CMS_ROUTE}/content/${collection}/new`,
  contentItem: (collection: string, id: string) => `${CMS_ROUTE}/content/${collection}/${id}`,
  legal: `${CMS_ROUTE}/legal`,
  legalNew: `${CMS_ROUTE}/legal/new`,
  legalItem: (id: string) => `${CMS_ROUTE}/legal/${id}`,
  templates: `${CMS_ROUTE}/email/templates`,
  templateNew: `${CMS_ROUTE}/email/templates/new`,
  templateItem: (id: string) => `${CMS_ROUTE}/email/templates/${id}`,
  emails: `${CMS_ROUTE}/email/messages`,
  emailNew: `${CMS_ROUTE}/email/messages/new`,
  emailItem: (id: string) => `${CMS_ROUTE}/email/messages/${id}`,
  audit: `${CMS_ROUTE}/audit`,
} as const;

/**
 * A separate storage namespace is what keeps the two sessions apart: signing out of the CMS must
 * not touch the session the site itself holds, and vice versa.
 */
export const CMS_AUTH_CONFIG: AuthClientConfig = {
  storageNamespace: "fs.cms",
  clientId: CMS_CLIENT_ID,
  baseUrl: AUTH_BASE_URL,
  scope: AUTH_SCOPE,
  signInRoute: CMS_SIGN_IN_ROUTE,
  callbackRoute: CMS_CALLBACK_ROUTE,
  redirectPath: CMS_REDIRECT_PATH,
  defaultReturnTo: CMS_ROUTE,
  returnToPrefix: CMS_ROUTE,
};
