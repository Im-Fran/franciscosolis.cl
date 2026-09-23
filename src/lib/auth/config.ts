/**
 * Where the auth service lives and how a front-end identifies itself to it.
 *
 * Every application hosted on this origin is its own OAuth client: the site itself signs in under
 * `franciscosolis-web` at `/auth`, the CMS under `franciscosolis-cms` at `/cms`. They talk to
 * the same issuer but get tokens minted for different applications — with different roles — so each
 * one keeps its own session. An `AuthClientConfig` describes one of them; `createAuthClient` in
 * `auth-client.ts` turns it into a working client.
 *
 * None of them collects credentials any more: every one of them starts a plain authorization code
 * request and lets the service's hosted screen at `/apps/auth` authenticate the user. The site's
 * own `signInRoute` below is where that hand-off is kicked off from, not a form.
 *
 * The issuer and the site's own client id are build-time env vars so a preview deployment can point
 * at another issuer or register under its own client id without a code change. See `.env.example`.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const AUTH_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_AUTH_BASE_URL ?? "https://api.franciscosolis.cl/auth",
);

export const AUTH_SCOPE = "openid profile email";

export type AuthClientConfig = {
  /**
   * Namespaces this client's entries in `localStorage`. Two applications must never share one, or
   * signing out of the CMS would take the site's session with it.
   */
  storageNamespace: string;
  /** Client id the application is registered under on the auth service. */
  clientId: string;
  /** Base URL of the auth service, without a trailing slash. */
  baseUrl: string;
  scope: string;
  /** Where the guard sends anonymous visitors. */
  signInRoute: string;
  /** Route that redeems the authorization code. */
  callbackRoute: string;
  /**
   * Path the authorization server sends the browser back to, when it is not `callbackRoute`
   * itself. The two only differ while an application is registered under a path the interface has
   * since moved away from: the service redirects to the registered path, the site forwards that
   * landing — query string intact — to the route that actually redeems the code, and the exchange
   * still quotes the registered value, as RFC 6749 §4.1.3 requires it to.
   */
  redirectPath?: string;
  /** Where a sign-in lands when it did not start from a particular page. */
  defaultReturnTo: string;
  /**
   * When set, a `return_to` is only honoured inside this path. The CMS uses it so a link into its
   * sign-in screen cannot bounce the editor into an unrelated part of the site.
   */
  returnToPrefix?: string;
};

/**
 * Base path of the auth interface inside this site: the sign-in hand-off, the callback the service
 * redirects back to, and the administration console.
 */
export const AUTH_ROUTE = "/auth";
export const CALLBACK_ROUTE = `${AUTH_ROUTE}/callback`;
export const ADMIN_ROUTE = `${AUTH_ROUTE}/admin`;

/**
 * Your account, at the top level rather than under `/auth`.
 *
 * `/auth` is the plumbing of one identity provider — a hand-off to the hosted screen, the callback
 * that redeems a code, the console that administers the service. An account is not plumbing: it is
 * the page a signed-in person opens from anywhere on this site, so it answers under its own name.
 */
export const ACCOUNT_ROUTE = "/account";

/** Where the account answered before it moved off `/auth`; `router.tsx` still forwards it. */
export const LEGACY_ACCOUNT_ROUTE = `${AUTH_ROUTE}/account`;

/**
 * The account's sections, so a tab is written once and linked to by name.
 *
 * Each one is a route for the same reason the console's are: a section of your own account is
 * something you land on, reload and link to, and `?tab=` gives none of that for free.
 */
export const accountRoute = {
  profile: ACCOUNT_ROUTE,
  signature: `${ACCOUNT_ROUTE}/signature`,
  access: `${ACCOUNT_ROUTE}/access`,
  identities: `${ACCOUNT_ROUTE}/identities`,
  sessions: `${ACCOUNT_ROUTE}/sessions`,
  details: `${ACCOUNT_ROUTE}/details`,
  purchases: `${ACCOUNT_ROUTE}/purchases`,
  notifications: `${ACCOUNT_ROUTE}/notifications`,
} as const;

/**
 * The administration console's own map, so a route is written once and linked to by name.
 *
 * The console used to be a single screen with its sections in `?tab=`, which made every section
 * unlinkable and every record unaddressable. These are real routes: `adminRoute.user(id)` is a URL
 * an operator can send to somebody else.
 */
export const adminRoute = {
  overview: ADMIN_ROUTE,
  users: `${ADMIN_ROUTE}/users`,
  user: (id: string) => `${ADMIN_ROUTE}/users/${encodeURIComponent(id)}`,
  sessions: `${ADMIN_ROUTE}/sessions`,
  avatars: `${ADMIN_ROUTE}/avatars`,
  /** The queue filtered to one account — the link a user's page offers. */
  userAvatars: (id: string) => `${ADMIN_ROUTE}/avatars?user_id=${encodeURIComponent(id)}`,
  invitations: `${ADMIN_ROUTE}/invitations`,
  applications: `${ADMIN_ROUTE}/applications`,
  newApplication: `${ADMIN_ROUTE}/applications/new`,
  application: (clientId: string) => `${ADMIN_ROUTE}/applications/${encodeURIComponent(clientId)}`,
  roles: `${ADMIN_ROUTE}/roles`,
  newRole: `${ADMIN_ROUTE}/roles/new`,
  role: (id: string) => `${ADMIN_ROUTE}/roles/${encodeURIComponent(id)}`,
  permissions: `${ADMIN_ROUTE}/permissions`,
  audit: `${ADMIN_ROUTE}/audit`,
  settings: `${ADMIN_ROUTE}/settings`,
} as const;

/**
 * Where a `?tab=` link from the old single-screen console should land.
 *
 * Those URLs were shared and bookmarked, and the roles tab is quoted in this repo's own docs, so
 * they are forwarded rather than dropped. An unknown tab falls through to the overview.
 */
export const legacyAdminTab = (tab: string | null): string | null =>
  tab === "users" ? adminRoute.users
  : tab === "invitations" ? adminRoute.invitations
  : tab === "applications" ? adminRoute.applications
  : tab === "roles" ? adminRoute.roles
  : null;

/**
 * This SPA is a *public* OAuth client: it holds no secret and authenticates with PKCE alone. The
 * application must be registered on the auth service with the callback below as a redirect URI.
 */
export const AUTH_CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID ?? "franciscosolis-web";

/**
 * Path the site is registered under, when it is not `/auth/callback`. A deployment that has to
 * answer on a path the service knows by another name sets `VITE_AUTH_REDIRECT_PATH` rather than
 * moving the route.
 */
export const AUTH_REDIRECT_PATH = import.meta.env.VITE_AUTH_REDIRECT_PATH ?? CALLBACK_ROUTE;

/**
 * The site's own client — the one `/auth` signs in with.
 *
 * `signInRoute` is not a credential form: it starts an authorization code request at the issuer's
 * own `GET /oauth/authorize` and waits, exactly as the CMS does. See `pages/auth/sign-in.tsx`.
 */
export const WEB_AUTH_CONFIG: AuthClientConfig = {
  storageNamespace: "fs.auth",
  clientId: AUTH_CLIENT_ID,
  baseUrl: AUTH_BASE_URL,
  scope: AUTH_SCOPE,
  signInRoute: AUTH_ROUTE,
  callbackRoute: CALLBACK_ROUTE,
  redirectPath: AUTH_REDIRECT_PATH,
  defaultReturnTo: ACCOUNT_ROUTE,
};

export const authUrl = (path: string) => `${AUTH_BASE_URL}${path}`;

/**
 * Absolute redirect URI handed to the authorization server; must match the registered one.
 *
 * Derived from the configured path rather than from where the browser happens to be, so the value
 * quoted when the code is redeemed is the same one the flow started with.
 */
export const redirectUri = (config: AuthClientConfig = WEB_AUTH_CONFIG) =>
  new URL(config.redirectPath ?? config.callbackRoute, window.location.origin).toString();

/** Absolute sign-in URL, used as the `login_url` of an emailed invitation. */
export const loginUrl = () => new URL(AUTH_ROUTE, window.location.origin).toString();

/**
 * Keeps `?return_to=` to paths inside this site — and, when the client asks for it, inside its own
 * section. An absolute or protocol-relative value would turn the sign-in screen into an open
 * redirect, so the value is resolved against this origin and kept only if it stayed here.
 *
 * Resolving rather than pattern-matching is the point: a leading-slash test looks safe and is not.
 * The URL parser treats a backslash as a slash in an http(s) URL and strips tab, CR and LF before
 * parsing, so `/\evil.com` and `/<tab>//evil.com` — the latter arriving decoded from
 * `?return_to=/%09//evil.com` — both name another host while passing every string check. Handing
 * the same parse the browser would perform is what closes that gap.
 */
export const sanitizeReturnTo = (
  value: string | null | undefined,
  config: AuthClientConfig = WEB_AUTH_CONFIG,
) => {
  if (!value || !value.startsWith("/")) return config.defaultReturnTo;

  let resolved: URL;
  try {
    resolved = new URL(value, window.location.origin);
  } catch {
    return config.defaultReturnTo;
  }
  if (resolved.origin !== window.location.origin) return config.defaultReturnTo;

  /* Re-serialized from the parse, so what is checked below is what the router will be handed. */
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;

  if (config.returnToPrefix) {
    /* Compare on segment boundaries, so `/cms-something` is not read as being inside the CMS. */
    const rest = path.startsWith(config.returnToPrefix) ? path.slice(config.returnToPrefix.length) : null;
    if (rest === null || (rest !== "" && !rest.startsWith("/") && !rest.startsWith("?"))) {
      return config.defaultReturnTo;
    }
  }

  return path;
};
