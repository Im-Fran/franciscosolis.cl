import {createAuthClient} from "@/lib/auth/auth-client.ts";
import {createHttpClient} from "@/lib/auth/client.ts";
import {CUSTOM_APPS_AUTH_CONFIG, CUSTOM_APPS_BASE_URL} from "@/lib/custom-apps/config.ts";
import type {
  Account,
  App,
  AppKey,
  AppPayload,
  AppSdk,
  AppStatusPayload,
  AppSummary,
  AuditEntry,
  AuditQuery,
  Company,
  CompanyContact,
  CompanyDetail,
  CompanyPayload,
  Contact,
  ContactDetail,
  ContactPayload,
  ContactRole,
  DailyStat,
  Deleted,
  Installation,
  InstallationPayload,
  InstallationQuery,
  InstallationSummary,
  MetricSeries,
  NewApp,
  Overview,
  Page,
  ServiceStatus,
  UsageDay,
  UsageEvent,
  UsageHeatmap,
} from "@/lib/custom-apps/types.ts";

/**
 * The panel's own auth stack, built once for the whole app: a second instance over the same storage
 * namespace would not hear about this one's sign-ins within the tab.
 *
 * It has to be its own — the service accepts only `franciscosolis-custom-apps` as an audience. See
 * `config.ts`.
 */
export const customAppsAuth = createAuthClient(CUSTOM_APPS_AUTH_CONFIG);

const http = createHttpClient(CUSTOM_APPS_BASE_URL, customAppsAuth.session);

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

/** Path segments come from the API's own ids, but they are still interpolated into a URL. */
const seg = (value: string) => encodeURIComponent(value);

/**
 * A paged list, read whole.
 *
 * Unlike the marketplace's lists, these report a `total` *beside* `data`, and unwrapping the envelope
 * — what `request` does by default — would throw away exactly the figure that tells the pager when
 * to stop.
 */
const page = <T>(path: string, signal?: AbortSignal) => http.request<Page<T>>(path, {signal, envelope: true});

export type ListQuery = {search?: string; limit?: number; offset?: number};

export const customAppsApi = {
  /** Public: the vocabularies, the ingest base and the heartbeat bounds. */
  status: (signal?: AbortSignal) => http.request<ServiceStatus>("/", {auth: false, signal}),

  /** The "may this account use the panel" probe. 403 for an account the service refuses. */
  me: (signal?: AbortSignal) => http.request<Account>("/v1/me", {signal}),

  overview: (signal?: AbortSignal) => http.request<Overview>("/v1/overview", {signal}),

  /* ── Companies ──────────────────────────────────────────────────────── */

  companies: {
    list: (params: ListQuery = {}, signal?: AbortSignal) =>
      page<Company>(`/v1/companies${query({...params})}`, signal),

    get: (id: string, signal?: AbortSignal) => http.request<CompanyDetail>(`/v1/companies/${seg(id)}`, {signal}),

    /** The RUT may go up with dots, a dash or spaces; the service normalises it and checks the digit. */
    create: (body: CompanyPayload & {legal_name: string}) =>
      http.request<Company>("/v1/companies", {method: "POST", json: body}),

    update: (id: string, body: CompanyPayload) =>
      http.request<Company>(`/v1/companies/${seg(id)}`, {method: "PATCH", json: body}),

    /** Refused with a 409 while the company still owns an app. */
    remove: (id: string) => http.request<Deleted>(`/v1/companies/${seg(id)}`, {method: "DELETE"}),

    /**
     * Links a contact to the company, or replaces the link that is there. Marking one primary clears
     * the flag on the company's other links, so the screen reloads the whole list afterwards.
     */
    link: (companyId: string, contactId: string, body: {roles: ContactRole[]; is_primary?: boolean}) =>
      http.request<CompanyContact>(`/v1/companies/${seg(companyId)}/contacts/${seg(contactId)}`, {
        method: "PUT",
        json: body,
      }),

    unlink: (companyId: string, contactId: string) =>
      http.request<Deleted>(`/v1/companies/${seg(companyId)}/contacts/${seg(contactId)}`, {method: "DELETE"}),
  },

  /* ── Contacts ───────────────────────────────────────────────────────── */

  contacts: {
    list: (params: ListQuery & {company_id?: string} = {}, signal?: AbortSignal) =>
      page<Contact>(`/v1/contacts${query({...params})}`, signal),

    get: (id: string, signal?: AbortSignal) => http.request<ContactDetail>(`/v1/contacts/${seg(id)}`, {signal}),

    create: (body: ContactPayload & {name: string}) =>
      http.request<Contact>("/v1/contacts", {method: "POST", json: body}),

    update: (id: string, body: ContactPayload) =>
      http.request<Contact>(`/v1/contacts/${seg(id)}`, {method: "PATCH", json: body}),

    /** Unlinks the contact from every company it belonged to. */
    remove: (id: string) => http.request<Deleted>(`/v1/contacts/${seg(id)}`, {method: "DELETE"}),
  },

  /* ── Apps ───────────────────────────────────────────────────────────── */

  apps: {
    list: (
      params: ListQuery & {company_id?: string; state?: string; kind?: string} = {},
      signal?: AbortSignal,
    ) => page<AppSummary>(`/v1/apps${query({...params})}`, signal),

    get: (id: string, signal?: AbortSignal) => http.request<App>(`/v1/apps/${seg(id)}`, {signal}),

    /** The app's first key is minted with it and comes back beside it, once. */
    create: (body: NewApp) => http.request<App & {key: AppKey}>("/v1/apps", {method: "POST", json: body}),

    update: (id: string, body: AppPayload) =>
      http.request<App>(`/v1/apps/${seg(id)}`, {method: "PATCH", json: body}),

    /** Refused with a 409 while the app still has installations. */
    remove: (id: string) => http.request<Deleted>(`/v1/apps/${seg(id)}`, {method: "DELETE"}),

    /** The kill switch: what every installation of the app is told on its next heartbeat. */
    setStatus: (id: string, body: AppStatusPayload) =>
      http.request<App>(`/v1/apps/${seg(id)}/status`, {method: "PUT", json: body}),

    sdk: (id: string, signal?: AbortSignal) => http.request<AppSdk>(`/v1/apps/${seg(id)}/sdk`, {signal}),

    usage: (id: string, params: {from?: string; to?: string} = {}, signal?: AbortSignal) =>
      http.request<UsageDay[]>(`/v1/apps/${seg(id)}/usage${query({...params})}`, {signal}),

    heatmap: (id: string, params: {installation_id?: string} = {}, signal?: AbortSignal) =>
      http.request<UsageHeatmap>(`/v1/apps/${seg(id)}/usage/heatmap${query({...params})}`, {signal}),

    installations: (id: string, params: InstallationQuery = {}, signal?: AbortSignal) =>
      page<InstallationSummary>(`/v1/apps/${seg(id)}/installations${query({...params})}`, signal),
  },

  /* ── App keys ───────────────────────────────────────────────────────── */

  /**
   * The keys a client app enrolls with. They are public by design — they ship inside the app — so
   * nothing here is shown once and hidden: revoking one only stops *new* enrollments, and the
   * installations already enrolled keep their own tokens.
   */
  keys: {
    list: (appId: string, signal?: AbortSignal) => http.request<AppKey[]>(`/v1/apps/${seg(appId)}/keys`, {signal}),

    create: (appId: string, body: {label?: string | null} = {}) =>
      http.request<AppKey>(`/v1/apps/${seg(appId)}/keys`, {method: "POST", json: body}),

    rotate: (appId: string, keyId: string) =>
      http.request<{key: AppKey; previous: AppKey}>(`/v1/apps/${seg(appId)}/keys/${seg(keyId)}/rotate`, {
        method: "POST",
      }),

    revoke: (appId: string, keyId: string) =>
      http.request<AppKey>(`/v1/apps/${seg(appId)}/keys/${seg(keyId)}/revoke`, {method: "POST"}),
  },

  /* ── Installations ──────────────────────────────────────────────────── */

  installations: {
    get: (id: string, signal?: AbortSignal) => http.request<Installation>(`/v1/installations/${seg(id)}`, {signal}),

    update: (id: string, body: InstallationPayload) =>
      http.request<Installation>(`/v1/installations/${seg(id)}`, {method: "PATCH", json: body}),

    review: (id: string) => http.request<Installation>(`/v1/installations/${seg(id)}/review`, {method: "POST"}),

    /** Invalidates the device's token at once; that device id can never enroll again. */
    revoke: (id: string) => http.request<Installation>(`/v1/installations/${seg(id)}/revoke`, {method: "POST"}),

    metrics: (id: string, params: {from?: string; to?: string; points?: number} = {}, signal?: AbortSignal) =>
      http.request<MetricSeries>(`/v1/installations/${seg(id)}/metrics${query({...params})}`, {signal}),

    daily: (id: string, params: {from?: string; to?: string} = {}, signal?: AbortSignal) =>
      http.request<DailyStat[]>(`/v1/installations/${seg(id)}/metrics/daily${query({...params})}`, {signal}),

    events: (id: string, params: {type?: string; limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      page<UsageEvent>(`/v1/installations/${seg(id)}/events${query({...params})}`, signal),
  },

  /* ── Audit log ──────────────────────────────────────────────────────── */

  audit: (params: AuditQuery = {}, signal?: AbortSignal) =>
    page<AuditEntry>(`/v1/audit-log${query({...params})}`, signal),
};
