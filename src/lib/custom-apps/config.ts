import {AUTH_BASE_URL, AUTH_SCOPE} from "@/lib/auth/config.ts";
import type {AuthClientConfig} from "@/lib/auth/config.ts";

/**
 * Where the custom-apps service lives, and how its panel identifies itself.
 *
 * The panel at `/custom-apps` is a client application of its own, `franciscosolis-custom-apps`, for
 * the same reason the marketplace console is: `apps/custom-apps` accepts **only** its own audience.
 * A panel signing in under any other client id is refused with a 401 before the permission is ever
 * read, which this side cannot tell apart from an expired session — and that loops through the
 * sign-in screen forever. It is also the narrowest arrangement worth having for a panel that reads
 * live telemetry off other people's machines: a token minted for the CMS should not be able to.
 *
 * The service has a second surface, the **ingest** (`ingest.franciscosolis.cl`), which belongs to the
 * client apps themselves. This site never calls it; the panel only shows its addresses so they can
 * be pasted into an app.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const CUSTOM_APPS_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_CUSTOM_APPS_BASE_URL ?? "https://api.franciscosolis.cl/custom-apps",
);

export const CUSTOM_APPS_CLIENT_ID = import.meta.env.VITE_CUSTOM_APPS_CLIENT_ID ?? "franciscosolis-custom-apps";

/** Base path of the panel, which is its own section of this site. */
export const CUSTOM_APPS_ROUTE = "/custom-apps";
export const CUSTOM_APPS_SIGN_IN_ROUTE = `${CUSTOM_APPS_ROUTE}/sign-in`;
export const CUSTOM_APPS_CALLBACK_ROUTE = `${CUSTOM_APPS_ROUTE}/callback`;

/**
 * Redirect URI the panel asks for. It matches `CUSTOM_APPS_CALLBACK_ROUTE`, because the auth service
 * compares redirect URIs byte for byte: the registered value and the route this site serves have to
 * be the same string.
 */
export const CUSTOM_APPS_REDIRECT_PATH = import.meta.env.VITE_CUSTOM_APPS_REDIRECT_PATH ?? CUSTOM_APPS_CALLBACK_ROUTE;

/**
 * Its own storage namespace, so signing out of this panel leaves the site's session, the CMS's and
 * the marketplace console's alone.
 */
export const CUSTOM_APPS_AUTH_CONFIG: AuthClientConfig = {
  storageNamespace: "fs.custom-apps",
  clientId: CUSTOM_APPS_CLIENT_ID,
  baseUrl: AUTH_BASE_URL,
  scope: AUTH_SCOPE,
  signInRoute: CUSTOM_APPS_SIGN_IN_ROUTE,
  callbackRoute: CUSTOM_APPS_CALLBACK_ROUTE,
  redirectPath: CUSTOM_APPS_REDIRECT_PATH,
  defaultReturnTo: CUSTOM_APPS_ROUTE,
  returnToPrefix: CUSTOM_APPS_ROUTE,
};

/** Every screen of the panel. Kept here so a link and its route cannot drift apart. */
export const customAppsRoute = {
  home: CUSTOM_APPS_ROUTE,
  companies: `${CUSTOM_APPS_ROUTE}/companies`,
  companyNew: `${CUSTOM_APPS_ROUTE}/companies/new`,
  company: (id: string) => `${CUSTOM_APPS_ROUTE}/companies/${encodeURIComponent(id)}`,
  contacts: `${CUSTOM_APPS_ROUTE}/contacts`,
  contactNew: `${CUSTOM_APPS_ROUTE}/contacts/new`,
  contact: (id: string) => `${CUSTOM_APPS_ROUTE}/contacts/${encodeURIComponent(id)}`,
  apps: `${CUSTOM_APPS_ROUTE}/apps`,
  /** `companyId` preselects the owner, for the "new app" button on a company. */
  appNew: (companyId?: string) =>
    `${CUSTOM_APPS_ROUTE}/apps/new${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ""}`,
  app: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}`,
  appInstallations: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/installations`,
  appUsage: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/usage`,
  appStatus: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/status`,
  appSettings: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/settings`,
  /** Flags and the remote configuration document, for an app with the `config` module. */
  appConfig: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/config`,
  appMessages: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/messages`,
  /** Crash groups and fleet logs, for an app with the `crashes` or `logs` module. */
  appDiagnostics: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/diagnostics`,
  /** The app's work log (bitácora). Not a module: work is logged whatever the app reports. */
  appWorkLog: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/work-log`,
  /** Releases uploaded from CI, for an app with the `updates` module. */
  appReleases: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/releases`,
  /** One release, addressed on its own like a crash group. */
  release: (id: string) => `${CUSTOM_APPS_ROUTE}/releases/${encodeURIComponent(id)}`,
  /** One crash group, addressed on its own like an installation. */
  crash: (id: string) => `${CUSTOM_APPS_ROUTE}/crashes/${encodeURIComponent(id)}`,
  /**
   * An installation is addressed on its own rather than under its app: the overview links to one
   * without knowing which app it belongs to, and the service answers it by id alone.
   */
  installation: (id: string) => `${CUSTOM_APPS_ROUTE}/installations/${encodeURIComponent(id)}`,
  /**
   * The alert inbox, optionally filtered. The notification centre links to one alert as
   * `/custom-apps/alerts/<id>`, so that shape is a contract with the service, not a choice here.
   */
  alerts: (filters: {app_id?: string; rule_id?: string; installation_id?: string; status?: string} = {}) => {
    const search = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return `${CUSTOM_APPS_ROUTE}/alerts${search ? `?${search}` : ""}`;
  },
  alertRules: `${CUSTOM_APPS_ROUTE}/alerts/rules`,
  alert: (id: string) => `${CUSTOM_APPS_ROUTE}/alerts/${encodeURIComponent(id)}`,
  audit: `${CUSTOM_APPS_ROUTE}/audit-log`,
  /** The support inbox, optionally filtered (`status=all` lists every status). */
  tickets: (filters: {status?: string; app_id?: string; company_id?: string; installation_id?: string; search?: string} = {}) => {
    const search = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return `${CUSTOM_APPS_ROUTE}/tickets${search ? `?${search}` : ""}`;
  },
  /**
   * One ticket. The notification centre links each `custom_apps.ticket_*` notification as
   * `/custom-apps/tickets/<id>`, so that shape is a contract with the service, not a choice here.
   */
  ticket: (id: string) => `${CUSTOM_APPS_ROUTE}/tickets/${encodeURIComponent(id)}`,
  contracts: `${CUSTOM_APPS_ROUTE}/contracts`,
  /** `companyId` preselects the client, for the "new contract" button on a company. */
  contractNew: (companyId?: string) =>
    `${CUSTOM_APPS_ROUTE}/contracts/new${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ""}`,
  /**
   * One contract. The `contract_expiring` and `cycle_hours_low` alerts and the contract audit
   * events link here.
   */
  contract: (id: string) => `${CUSTOM_APPS_ROUTE}/contracts/${encodeURIComponent(id)}`,
  contractEdit: (id: string) => `${CUSTOM_APPS_ROUTE}/contracts/${encodeURIComponent(id)}/edit`,
  /**
   * Every scheduled maintenance, optionally filtered — `view=calendar` opens the month grid, `month`
   * (`YYYY-MM`) picks which month.
   */
  maintenances: (
    filters: {status?: string; kind?: string; app_id?: string; company_id?: string; from?: string; to?: string; view?: string; month?: string} = {},
  ) => {
    const search = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return `${CUSTOM_APPS_ROUTE}/maintenances${search ? `?${search}` : ""}`;
  },
  /**
   * One maintenance. The notification centre links every `custom_apps.maintenance_*` notification as
   * `/custom-apps/maintenances/<id>`, so that shape is a contract with the service, not a choice here.
   */
  maintenance: (id: string) => `${CUSTOM_APPS_ROUTE}/maintenances/${encodeURIComponent(id)}`,
  /** The app's maintenances tab. */
  appMaintenances: (id: string) => `${CUSTOM_APPS_ROUTE}/apps/${encodeURIComponent(id)}/maintenances`,
} as const;

/**
 * The public approval page a client opens from the email, outside the panel and without a login.
 * The service builds the address (`MAINTENANCE_LINK_BASE_URL` + token), so this path is a contract
 * with it.
 */
export const MAINTENANCE_APPROVAL_ROUTE = "/mantencion";
