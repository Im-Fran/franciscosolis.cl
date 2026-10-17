import {createAuthClient} from "@/lib/auth/auth-client.ts";
import {createHttpClient} from "@/lib/auth/client.ts";
import {CUSTOM_APPS_AUTH_CONFIG, CUSTOM_APPS_BASE_URL} from "@/lib/custom-apps/config.ts";
import type {
  Account,
  AlertEntry,
  AlertQuery,
  AlertRule,
  AlertRulePayload,
  App,
  AppMessage,
  AppKey,
  AppPayload,
  AppSdk,
  AppStatusPayload,
  AppSummary,
  AuditEntry,
  AuditQuery,
  CiToken,
  Company,
  CompanyContact,
  CompanyDetail,
  CompanyPayload,
  Command,
  CommandStatus,
  ConfigDocument,
  ConfigPayload,
  ConfigVersion,
  Contact,
  ContactDetail,
  ContactPayload,
  CrashGroup,
  CrashQuery,
  CrashReport,
  CrashStatus,
  Flag,
  FlagPayload,
  HeartbeatEntry,
  ContactRole,
  DailyStat,
  Deleted,
  Installation,
  InstallationPayload,
  InstallationQuery,
  InstallationSummary,
  InstallationUpdates,
  LogEntry,
  LogQuery,
  MessagePayload,
  MessageReceipt,
  MetricSeries,
  NewAlertRule,
  NewApp,
  NewCommand,
  NewFlag,
  NewCiToken,
  NewMessage,
  Overview,
  Page,
  ReleaseDetail,
  ReleaseListItem,
  ReleasePayload,
  ReleaseQuery,
  ReleaseReport,
  RolloutPayload,
  Screenshot,
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

    /** Every installation's log entries, newest first. Kept 30 days. */
    logs: (id: string, params: LogQuery = {}, signal?: AbortSignal) =>
      page<LogEntry>(`/v1/apps/${seg(id)}/logs${query({...params})}`, signal),
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
    /** Every heartbeat as it arrived, newest first. */
    heartbeats: (id: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      page<HeartbeatEntry>(`/v1/installations/${seg(id)}/heartbeats${query({...params})}`, signal),

    /** This device's log entries, newest first. `level` means "at least this severe". */
    logs: (id: string, params: Omit<LogQuery, "installation_id"> = {}, signal?: AbortSignal) =>
      page<LogEntry>(`/v1/installations/${seg(id)}/logs${query({...params})}`, signal),

    /**
     * What the device would be offered right now (null when nothing) beside a page of the update
     * reports it sent. One envelope with both, so it is read whole like a page.
     */
    updates: (id: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      http.request<InstallationUpdates>(`/v1/installations/${seg(id)}/updates${query({...params})}`, {
        signal,
        envelope: true,
      }),
  },

  /* ── Commands and screenshots ───────────────────────────────────────── */

  /**
   * What the panel asks one device to do. A command waits as `pending` until the device picks it up
   * — on its next heartbeat, or at once over the live socket — and expires if it never does.
   */
  commands: {
    list: (
      installationId: string,
      params: {status?: CommandStatus; limit?: number; offset?: number} = {},
      signal?: AbortSignal,
    ) => page<Command>(`/v1/installations/${seg(installationId)}/commands${query({...params})}`, signal),

    /**
     * Refused with a 409 for a revoked installation, an app without the commands module, a device
     * restart on anything but a kiosk, or a screenshot the app or the device does not allow.
     */
    create: (installationId: string, body: NewCommand) =>
      http.request<Command>(`/v1/installations/${seg(installationId)}/commands`, {method: "POST", json: body}),

    /** Refused with a 409 once the command has finished, one way or another. */
    cancel: (id: string) => http.request<Command>(`/v1/commands/${seg(id)}/cancel`, {method: "POST"}),
  },

  screenshots: {
    list: (installationId: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      page<Screenshot>(`/v1/installations/${seg(installationId)}/screenshots${query({...params})}`, signal),

    /**
     * The image itself, as bytes. `image_path` is relative to the service's base and needs the
     * bearer token, so it is fetched here and shown through an object URL rather than handed to an
     * `<img src>` that would arrive without one.
     */
    image: (imagePath: string, signal?: AbortSignal) => http.request<Blob>(imagePath, {signal, blob: true}),

    remove: (id: string) => http.request<Deleted>(`/v1/screenshots/${seg(id)}`, {method: "DELETE"}),
  },

  /* ── Flags and remote configuration ─────────────────────────────────── */

  /** Per device, the most specific flag wins: installation, then channel, then app. */
  flags: {
    list: (appId: string, signal?: AbortSignal) => page<Flag>(`/v1/apps/${seg(appId)}/flags`, signal),

    /** 409 when the key is already set at that scope; 422 for an unknown channel or installation. */
    create: (appId: string, body: NewFlag) =>
      http.request<Flag>(`/v1/apps/${seg(appId)}/flags`, {method: "POST", json: body}),

    update: (id: string, body: FlagPayload) =>
      http.request<Flag>(`/v1/flags/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (id: string) => http.request<Deleted>(`/v1/flags/${seg(id)}`, {method: "DELETE"}),
  },

  config: {
    get: (appId: string, signal?: AbortSignal) => http.request<ConfigDocument>(`/v1/apps/${seg(appId)}/config`, {signal}),

    /**
     * Publishes a new version. 409 when `base_version` is no longer the latest; 422, with `issues`,
     * when the document fails the schema or the schema uses a keyword the service does not support.
     */
    save: (appId: string, body: ConfigPayload) =>
      http.request<ConfigDocument>(`/v1/apps/${seg(appId)}/config`, {method: "PUT", json: body}),

    history: (appId: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      page<ConfigVersion>(`/v1/apps/${seg(appId)}/config/history${query({...params})}`, signal),

    /** Saves an old version again as the newest one. 422 when it fails the current schema. */
    restore: (appId: string, version: number) =>
      http.request<ConfigDocument>(`/v1/apps/${seg(appId)}/config/history/${version}/restore`, {method: "POST"}),
  },

  /* ── Messages ───────────────────────────────────────────────────────── */

  messages: {
    list: (
      appId: string,
      params: {status?: "active" | "scheduled" | "ended" | "all"; limit?: number; offset?: number} = {},
      signal?: AbortSignal,
    ) => page<AppMessage>(`/v1/apps/${seg(appId)}/messages${query({...params})}`, signal),

    create: (appId: string, body: NewMessage) =>
      http.request<AppMessage>(`/v1/apps/${seg(appId)}/messages`, {method: "POST", json: body}),

    update: (id: string, body: MessagePayload) =>
      http.request<AppMessage>(`/v1/messages/${seg(id)}`, {method: "PATCH", json: body}),

    remove: (id: string) => http.request<Deleted>(`/v1/messages/${seg(id)}`, {method: "DELETE"}),

    /** Which installations have shown it, and when. */
    receipts: (id: string, signal?: AbortSignal) => page<MessageReceipt>(`/v1/messages/${seg(id)}/receipts`, signal),
  },

  /* ── Crashes ────────────────────────────────────────────────────────── */

  /** Crash reports grouped by signature and version. Reports are kept 30 days. */
  crashes: {
    list: (appId: string, params: CrashQuery = {}, signal?: AbortSignal) =>
      page<CrashGroup>(`/v1/apps/${seg(appId)}/crashes${query({...params})}`, signal),

    get: (id: string, signal?: AbortSignal) => http.request<CrashGroup>(`/v1/crashes/${seg(id)}`, {signal}),

    reports: (id: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      page<CrashReport>(`/v1/crashes/${seg(id)}/reports${query({...params})}`, signal),

    setStatus: (id: string, status: CrashStatus) =>
      http.request<CrashGroup>(`/v1/crashes/${seg(id)}`, {method: "PATCH", json: {status}}),
  },

  /* ── Alerts ─────────────────────────────────────────────────────────── */

  /** The conditions the service watches for. Whoever creates a rule is the one notified. */
  alertRules: {
    list: (params: {app_id?: string} = {}, signal?: AbortSignal) =>
      page<AlertRule>(`/v1/alert-rules${query({...params})}`, signal),

    create: (body: NewAlertRule) => http.request<AlertRule>("/v1/alert-rules", {method: "POST", json: body}),

    update: (id: string, body: AlertRulePayload) =>
      http.request<AlertRule>(`/v1/alert-rules/${seg(id)}`, {method: "PATCH", json: body}),

    /** Deletes the rule's alerts with it. */
    remove: (id: string) => http.request<Deleted>(`/v1/alert-rules/${seg(id)}`, {method: "DELETE"}),
  },

  alerts: {
    list: (params: AlertQuery = {}, signal?: AbortSignal) => page<AlertEntry>(`/v1/alerts${query({...params})}`, signal),

    get: (id: string, signal?: AbortSignal) => http.request<AlertEntry>(`/v1/alerts/${seg(id)}`, {signal}),

    acknowledge: (id: string) => http.request<AlertEntry>(`/v1/alerts/${seg(id)}/ack`, {method: "POST"}),

    /** If the condition still holds, the next evaluation opens it again. */
    resolve: (id: string, note?: string | null) =>
      http.request<AlertEntry>(`/v1/alerts/${seg(id)}/resolve`, {method: "POST", json: note ? {note} : {}}),
  },

  /* ── CI tokens ──────────────────────────────────────────────────────── */

  /**
   * What CI uploads releases with. Unlike an app key, a CI token is a secret: the service keeps only
   * its hash, so the token itself comes back once, in the answer to `create`, and never again.
   */
  ciTokens: {
    list: (appId: string, signal?: AbortSignal) =>
      http.request<CiToken[]>(`/v1/apps/${seg(appId)}/ci-tokens`, {signal}),

    create: (appId: string, body: {label?: string | null} = {}) =>
      http.request<NewCiToken>(`/v1/apps/${seg(appId)}/ci-tokens`, {method: "POST", json: body}),

    /** The next upload with it is refused; releases it already uploaded are untouched. */
    revoke: (id: string) => http.request<CiToken>(`/v1/ci-tokens/${seg(id)}/revoke`, {method: "POST"}),
  },

  /* ── Releases ───────────────────────────────────────────────────────── */

  /**
   * Releases arrive from CI as drafts; everything after that is decided here. Each transition is
   * refused with a 409 from a status it does not apply to, and answers with the release as it now
   * stands, stats included.
   */
  releases: {
    list: (appId: string, params: ReleaseQuery = {}, signal?: AbortSignal) =>
      page<ReleaseListItem>(`/v1/apps/${seg(appId)}/releases${query({...params})}`, signal),

    get: (id: string, signal?: AbortSignal) => http.request<ReleaseDetail>(`/v1/releases/${seg(id)}`, {signal}),

    /** Notes, the minimum version, and the installations offered it whatever the percentage says. */
    update: (id: string, body: ReleasePayload) =>
      http.request<ReleaseDetail>(`/v1/releases/${seg(id)}`, {method: "PATCH", json: body}),

    /** Drafts only. */
    publish: (id: string, body: {rollout_percent: number; installation_ids?: string[]}) =>
      http.request<ReleaseDetail>(`/v1/releases/${seg(id)}/publish`, {method: "POST", json: body}),

    /** Published or paused only. Narrowing it stops offering it; it uninstalls nothing. */
    rollout: (id: string, body: RolloutPayload) =>
      http.request<ReleaseDetail>(`/v1/releases/${seg(id)}/rollout`, {method: "POST", json: body}),

    pause: (id: string, reason?: string | null) =>
      http.request<ReleaseDetail>(`/v1/releases/${seg(id)}/pause`, {method: "POST", json: reason ? {reason} : {}}),

    resume: (id: string) => http.request<ReleaseDetail>(`/v1/releases/${seg(id)}/resume`, {method: "POST"}),

    /** Devices running it are offered the newest earlier version of their line as a rollback. */
    withdraw: (id: string, reason?: string | null) =>
      http.request<ReleaseDetail>(`/v1/releases/${seg(id)}/withdraw`, {method: "POST", json: reason ? {reason} : {}}),

    /**
     * Rolls the whole line back to this release: every newer published or paused release of the same
     * channel, platform and architecture is withdrawn, and this one is published to 100 %.
     */
    rollback: (id: string, reason?: string | null) =>
      http.request<ReleaseDetail>(`/v1/releases/${seg(id)}/rollback`, {method: "POST", json: reason ? {reason} : {}}),

    /** Drafts only: a release that was ever published is history. */
    remove: (id: string) => http.request<Deleted>(`/v1/releases/${seg(id)}`, {method: "DELETE"}),

    /** The artifact's bytes, behind the bearer token like a screenshot. */
    artifact: (id: string, signal?: AbortSignal) =>
      http.request<Blob>(`/v1/releases/${seg(id)}/artifact`, {signal, blob: true}),

    reports: (id: string, params: {limit?: number; offset?: number} = {}, signal?: AbortSignal) =>
      page<ReleaseReport>(`/v1/releases/${seg(id)}/reports${query({...params})}`, signal),
  },

  /* ── Audit log ──────────────────────────────────────────────────────── */

  audit: (params: AuditQuery = {}, signal?: AbortSignal) =>
    page<AuditEntry>(`/v1/audit-log${query({...params})}`, signal),
};
