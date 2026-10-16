/**
 * The custom-apps service's vocabulary and shapes, as its phase-one contract describes them.
 *
 * The vocabularies are also served by `GET /`, and the panel prefers those when it has them (see
 * `useServiceVocabulary`). The constants here are the fallback for a service that did not answer —
 * a form that offers nothing because one probe failed is worse than one offering last release's list.
 */

export const APP_KINDS = ["web", "desktop", "android", "kiosk"] as const;
export type AppKind = (typeof APP_KINDS)[number];

export const PLATFORMS = ["windows", "macos", "linux", "android", "web"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const APP_STATES = ["active", "grace", "maintenance", "suspended"] as const;
export type AppState = (typeof APP_STATES)[number];

export const CHANNELS = ["stable", "beta"] as const;
export type Channel = (typeof CHANNELS)[number];

/** `socket` arrives with remote control, in a later phase. */
export const PRESENCE_MODES = ["ping"] as const;
export type PresenceMode = (typeof PRESENCE_MODES)[number];

/** Presence — the heartbeat — is always on, so it is not a module. */
export const APP_MODULES = ["metrics", "events"] as const;
export type AppModule = (typeof APP_MODULES)[number];

export const CONTACT_ROLES = ["owner", "technical", "billing", "maintenance_approver"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const INSTALLATION_STATUSES = ["active", "revoked"] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The service's own default, used until `GET /` says otherwise. */
export const DEFAULT_TIMEZONE = "America/Santiago";

export type ServiceStatus = {
  message: string;
  ingest_base_url: string;
  kinds: AppKind[];
  platforms: Platform[];
  states: AppState[];
  channels: Channel[];
  presence_modes: PresenceMode[];
  modules: AppModule[];
  contact_roles: ContactRole[];
  /** Seconds. */
  heartbeat_interval: {min: number; max: number; default: number};
  /** An installation counts as connected while `last_seen_at >= now - this × interval`. */
  offline_after_intervals: number;
  retention: {raw_days: number};
  timezone: string;
};

export type Account = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  roles: string[];
  permissions: string[];
};

/** A list endpoint's whole answer: the rows and the paging the service reports beside them. */
export type Page<T> = {
  code: number;
  data: T[];
  pagination: {limit: number; offset: number; total: number};
};

export type Deleted = {id?: string; deleted: true};

/* ── CRM ──────────────────────────────────────────────────────────────── */

export type Company = {
  id: string;
  /** Razón social, or the full name of a natural person. */
  legal_name: string;
  /** Nombre de fantasía. */
  trade_name: string | null;
  /** Normalised `12345678-5`: no dots, uppercase K. */
  rut: string | null;
  /** Giro. */
  business_activity: string | null;
  address: string | null;
  /** False for a natural person (persona natural). */
  is_company: boolean;
  notes: string | null;
  app_count: number;
  contact_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type CompanyRef = Pick<Company, "id" | "legal_name" | "trade_name">;

export type CompanyPayload = {
  legal_name?: string;
  trade_name?: string | null;
  rut?: string | null;
  business_activity?: string | null;
  address?: string | null;
  is_company?: boolean;
  notes?: string | null;
};

export type Contact = {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  address: string | null;
  notes: string | null;
  company_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ContactPayload = {
  name?: string;
  emails?: string[];
  phones?: string[];
  address?: string | null;
  notes?: string | null;
};

export type CompanyContactLink = {
  company_id: string;
  contact_id: string;
  roles: ContactRole[];
  is_primary: boolean;
  created_at: string;
};

export type CompanyContact = CompanyContactLink & {contact: Contact};

export type CompanyDetail = Company & {
  contacts: CompanyContact[];
  apps: AppSummary[];
};

export type ContactDetail = Contact & {
  companies: Array<CompanyContactLink & {company: Pick<Company, "id" | "legal_name" | "trade_name" | "rut">}>;
};

/* ── Apps ─────────────────────────────────────────────────────────────── */

export type TimeWindow = {start: string; end: string};

export type OperatingHours = {
  /** IANA zone the windows are written in. */
  timezone: string;
  /** Zero or more `[start, end)` windows per weekday, `HH:MM` 24 h. A missing day is closed. */
  days: Partial<Record<Weekday, TimeWindow[]>>;
};

export type AppSummary = {
  id: string;
  company_id: string;
  name: string;
  kind: AppKind;
  state: AppState;
  installation_count: number;
  connected_count: number;
  created_at: string;
  updated_at: string;
  /** Present on the app list, which crosses companies. */
  company?: CompanyRef;
};

export type App = AppSummary & {
  description: string | null;
  /** Hostname only, for web apps. */
  domain: string | null;
  repository_url: string | null;
  presence_mode: PresenceMode;
  heartbeat_interval_seconds: number;
  operating_hours: OperatingHours | null;
  modules: AppModule[];
  /** What the app shows while in grace, maintenance or suspended. */
  state_message: string | null;
  /** End of the grace period, or the ETA of a maintenance. */
  state_until: string | null;
  needs_review_count: number;
  company: CompanyRef;
  ingest: {base_url: string; sdk_url: string; openapi_url: string};
  created_by: string | null;
  updated_by: string | null;
};

export type NewApp = {
  company_id: string;
  name: string;
  kind: AppKind;
  description?: string | null;
  domain?: string | null;
  repository_url?: string | null;
  heartbeat_interval_seconds?: number;
  operating_hours?: OperatingHours | null;
  modules?: AppModule[];
};

export type AppPayload = Partial<Omit<NewApp, "company_id" | "name" | "kind">> & {
  company_id?: string;
  name?: string;
  kind?: AppKind;
  presence_mode?: PresenceMode;
};

export type AppStatusPayload = {state: AppState; message?: string | null; until?: string | null};

export type AppSdk = {
  url: string;
  /** `sha384-…`, for the `integrity` attribute. */
  integrity: string;
  modules: AppModule[];
  /** False while the app has no active key: there is nothing for the script to enroll with. */
  available: boolean;
};

export type AppKey = {
  id: string;
  app_id: string;
  /** Public by design (`cak_…`): it is embedded in the client apps. */
  key: string;
  label: string | null;
  status: "active" | "revoked";
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  /** The key a rotation created in this one's place. */
  replaced_by: string | null;
};

/* ── Installations ────────────────────────────────────────────────────── */

/** The last heartbeat's light snapshot. Every field may be absent: absent or null reads as N/A. */
export type Snapshot = {
  cpu_percent?: number | null;
  memory_used_bytes?: number | null;
  memory_total_bytes?: number | null;
  gpu_percent?: number | null;
  disk_used_bytes?: number | null;
  disk_total_bytes?: number | null;
  net_rx_bytes?: number | null;
  net_tx_bytes?: number | null;
  battery_percent?: number | null;
  battery_charging?: boolean | null;
  power_watts?: number | null;
  uptime_seconds?: number | null;
};

export type InstallationSummary = {
  id: string;
  app_id: string;
  alias: string | null;
  device_id: string;
  platform: Platform;
  os_name: string | null;
  os_version: string | null;
  arch: string | null;
  hostname: string | null;
  app_version: string | null;
  channel: Channel;
  status: InstallationStatus;
  connected: boolean;
  needs_review: boolean;
  last_seen_at: string | null;
  enrolled_at: string;
  /** Present on the lists that cross apps (the overview). */
  app?: {id: string; name: string};
};

export type Installation = InstallationSummary & {
  previous_app_version: string | null;
  user_agent: string | null;
  last_ip: string | null;
  enrolled_ip: string | null;
  last_snapshot: Snapshot | null;
  state_override: AppState | null;
  state_message: string | null;
  effective_state: AppState;
  reviewed_at: string | null;
  reviewed_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  heartbeat_interval_seconds: number;
};

export type InstallationPayload = {
  alias?: string | null;
  channel?: Channel;
  state_override?: AppState | null;
  state_message?: string | null;
};

export type InstallationQuery = {
  status?: InstallationStatus;
  needs_review?: boolean;
  connected?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

/* ── Telemetry ────────────────────────────────────────────────────────── */

export type MetricPoint = {
  /** Bucket start. */
  t: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  memory_used_bytes: number | null;
  gpu_percent: number | null;
  disk_percent: number | null;
  /** Summed over the bucket. */
  net_rx_bytes: number | null;
  net_tx_bytes: number | null;
  battery_percent: number | null;
  power_watts: number | null;
  samples: number;
};

export type MetricSeries = {from: string; to: string; bucket_seconds: number; points: MetricPoint[]};

export type DailyStat = {
  /** `YYYY-MM-DD` in the service's timezone. */
  day: string;
  online_seconds: number;
  active_seconds: number;
  cpu_avg: number | null;
  cpu_max: number | null;
  cpu_p95: number | null;
  memory_avg: number | null;
  memory_max: number | null;
  memory_p95: number | null;
  gpu_avg: number | null;
  gpu_max: number | null;
  net_rx_bytes: number;
  net_tx_bytes: number;
  battery_min: number | null;
  samples: number;
  events: number;
};

export type UsageEvent = {
  id: string;
  type: string;
  name: string | null;
  session_id: string | null;
  occurred_at: string;
  received_at: string;
  properties: Record<string, unknown> | null;
};

export type UsageDay = {
  day: string;
  online_seconds: number;
  active_seconds: number;
  /** Installations that reported that day. */
  installations: number;
  events: number;
};

export type UsageHeatmap = {
  timezone: string;
  days: number;
  /** `[weekday 0 = Monday … 6 = Sunday][hour 0…23]`, average active seconds in that hour. */
  cells: number[][];
  /** The same grid for online seconds. */
  online: number[][];
  max: number;
};

/* ── Overview and audit ───────────────────────────────────────────────── */

export type Overview = {
  installations: {total: number; active: number; connected: number; needs_review: number; revoked: number};
  apps: {total: number; by_state: Record<AppState, number>};
  companies: {total: number};
  contacts: {total: number};
  /** The last ten enrolled, newest first. */
  recent_installations: InstallationSummary[];
  /** Up to ten, oldest first. */
  needs_review: InstallationSummary[];
};

export type AuditEntry = {
  id: string;
  event: string;
  actor_email: string | null;
  actor_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  /** Includes `{ before, after }` for the writes that changed a record. */
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditQuery = {
  event?: string;
  resource_type?: string;
  resource_id?: string;
  actor?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
