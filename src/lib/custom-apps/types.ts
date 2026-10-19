/**
 * The custom-apps service's vocabulary and shapes, as its phase-one, phase-two, phase-three and
 * phase-four contracts describe them.
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

/**
 * `socket` is for kiosks and points of sale: a native app holds a WebSocket open, which is how a
 * command reaches it at once. A website always pings, whatever its app says.
 */
export const PRESENCE_MODES = ["ping", "socket"] as const;
export type PresenceMode = (typeof PRESENCE_MODES)[number];

/**
 * Presence — the heartbeat — is always on, so it is not a module. `support` is support tickets opened
 * from inside the app, with the device's context attached, answered from this panel and read back by
 * the app.
 */
export const APP_MODULES = [
  "metrics",
  "events",
  "logs",
  "crashes",
  "config",
  "messages",
  "commands",
  "updates",
  "support",
] as const;
export type AppModule = (typeof APP_MODULES)[number];

/* ── Phase two: remote operation ──────────────────────────────────────── */

export const LOG_LEVELS = ["debug", "info", "warning", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const COMMAND_TYPES = [
  "restart_app",
  "restart_device",
  "reload_config",
  "clear_cache",
  "screenshot",
  "upload_logs",
  "check_update",
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_STATUSES = ["pending", "delivered", "succeeded", "failed", "expired", "cancelled"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/** A flag or a message applies to the whole app, one channel of it, or one installation. */
export const TARGET_SCOPES = ["app", "channel", "installation"] as const;
export type TargetScope = (typeof TARGET_SCOPES)[number];

export const MESSAGE_SEVERITIES = ["info", "warning", "critical"] as const;
export type MessageSeverity = (typeof MESSAGE_SEVERITIES)[number];

export const MESSAGE_DISPLAYS = ["banner", "modal"] as const;
export type MessageDisplay = (typeof MESSAGE_DISPLAYS)[number];

export const CRASH_STATUSES = ["open", "resolved", "ignored"] as const;
export type CrashStatus = (typeof CRASH_STATUSES)[number];

export const ALERT_KINDS = [
  "installation_offline",
  "cpu_high",
  "memory_high",
  "crash_spike",
  "error_log_spike",
  "enrollment_spike",
  "release_rollbacks",
  "contract_expiring",
  "cycle_hours_low",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/* ── Phase three: releases and the updater ────────────────────────────── */

/**
 * A release's lifecycle: `draft` is offered to nobody, `published` to the devices its rollout
 * reaches, `paused` to nobody new (by hand, or automatically on a bad rollback or crash rate), and
 * `withdrawn` is pulled — devices running it are offered the newest earlier version as a rollback.
 */
export const RELEASE_STATUSES = ["draft", "published", "paused", "withdrawn"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** What a device reports while it updates, in the order it happens. `health_ok` is the only success. */
export const UPDATE_REPORT_STATUSES = ["downloaded", "installed", "health_ok", "rolled_back", "failed"] as const;
export type UpdateReportStatus = (typeof UPDATE_REPORT_STATUSES)[number];

/** What an artifact is built for. `any` fits every architecture of its platform. */
export const ARCHES = ["x86_64", "aarch64", "x86", "armv7", "universal", "any"] as const;
export type Arch = (typeof ARCHES)[number];

/** The largest artifact the service accepts, in bytes, until it says otherwise. */
export const RELEASE_MAX_BYTES = 96 * 1024 * 1024;

/** The per-app updater settings: the service's bounds and defaults. */
export const UPDATE_SETTINGS = {
  healthTimeout: {min: 30, max: 86_400, default: 600},
  maxFailures: {min: 1, max: 100, default: 3},
  pauseRollbackPercent: {min: 1, max: 100, default: 20},
  pauseCrashPercent: {min: 1, max: 100, default: 20},
} as const;

/** How far ahead a grace period may end, in days, until the service says otherwise. */
export const GRACE_MAX_DAYS = 31;

/* ── Phase four: contracts, hours cycles and the work log ─────────────── */

/** CLP is a whole number of pesos; UF carries up to two decimals. */
export const CURRENCIES = ["CLP", "UF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BILLING_PERIODS = ["monthly", "yearly", "one_time"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** How long one hours cycle lasts. Cycles are anchored on the contract's `starts_on`. */
export const CYCLE_PERIODS = ["daily", "weekly", "monthly"] as const;
export type CyclePeriod = (typeof CYCLE_PERIODS)[number];

/** `open` while it runs (and until closed), `closed` with a final balance, `billed` once invoiced. */
export const CYCLE_STATUSES = ["open", "closed", "billed"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

/**
 * - `scheduled`: not started yet.
 * - `active`: running (open-ended, or not past its last day).
 * - `grace`: past its end without renewal, inside its grace days.
 * - `ended`: past its end and its grace.
 * - `cancelled`: cancelled by hand, whatever its dates say.
 */
export const CONTRACT_STATUSES = ["scheduled", "active", "grace", "ended", "cancelled"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/** What a lapsed contract still lets its apps do while in grace. */
export const GRACE_ALLOWANCES = ["updates", "support"] as const;
export type GraceAllowance = (typeof GRACE_ALLOWANCES)[number];

export const WORK_KINDS = ["maintenance", "support", "development", "other"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/**
 * A support ticket's lifecycle:
 *
 * - `open`: waiting on us — new, or the requester wrote again.
 * - `pending`: answered, waiting on the requester.
 * - `resolved`: done; a new message from the requester reopens it.
 * - `closed`: done for good; the requester has to open a new ticket.
 */
export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** The inbox filter adds `active`, shorthand for what still needs somebody: `open` and `pending`. */
export type TicketStatusFilter = TicketStatus | "active";

/** What a reply may leave a ticket as. `pending` — waiting on the requester — unless it says otherwise. */
export const REPLY_STATUSES = ["pending", "resolved", "closed"] as const;
export type ReplyStatus = (typeof REPLY_STATUSES)[number];

/** The service's bounds for a ticket, until it says otherwise. */
export const TICKET_LIMITS = {maxSubjectLength: 200, maxMessageLength: 5000} as const;

/** The service's bounds for contracts and the work log, until `GET /` says otherwise. */
export const CONTRACT_LIMITS = {
  max_grace_days: 30,
  max_notice_days: 180,
  default_notice_days: 30,
  max_work_log_minutes: 1440,
} as const;

export type ContractLimits = {
  max_grace_days: number;
  max_notice_days: number;
  default_notice_days: number;
  /** The largest single work log entry, in minutes. */
  max_work_log_minutes: number;
};

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
  log_levels?: LogLevel[];
  command_types?: CommandType[];
  command_statuses?: CommandStatus[];
  target_scopes?: TargetScope[];
  message_severities?: MessageSeverity[];
  message_displays?: MessageDisplay[];
  crash_statuses?: CrashStatus[];
  alert_kinds?: AlertKind[];
  alert_statuses?: AlertStatus[];
  /** The furthest a grace period may end from now, in days. */
  grace_max_days?: number;
  /** The largest screenshot the service keeps, in bytes. */
  screenshot_max_bytes?: number;
  release_statuses?: ReleaseStatus[];
  update_report_statuses?: UpdateReportStatus[];
  arches?: Arch[];
  /** The largest release artifact the service accepts, in bytes. */
  release_max_bytes?: number;
  currencies?: Currency[];
  billing_periods?: BillingPeriod[];
  cycle_periods?: CyclePeriod[];
  cycle_statuses?: CycleStatus[];
  contract_statuses?: ContractStatus[];
  grace_allowances?: GraceAllowance[];
  work_kinds?: WorkKind[];
  contract_limits?: ContractLimits;
  ticket_statuses?: TicketStatus[];
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
  /**
   * End of the grace period — required for grace, and the app is suspended automatically when it
   * passes — or the ETA of a maintenance, which changes nothing on its own.
   */
  state_until: string | null;
  /** The least severe log entry the app's installations send, unless one overrides it. */
  log_level: LogLevel;
  /**
   * Off until the client's contract allows them: a screenshot can show the client's own customers,
   * which makes it personal data (ley 21.719).
   */
  screenshots_enabled: boolean;
  /**
   * The Ed25519 public key release uploads are verified against: base64 of the raw 32 bytes. Null
   * until one is set, and no upload is accepted before then. Optional so a service that predates
   * releases still renders.
   */
  release_public_key?: string | null;
  /** How long a device waits for the new version to report healthy before rolling back, seconds. */
  update_health_timeout_seconds?: number;
  /** Failed attempts at one release before a device stops trying it. */
  update_max_failures?: number;
  /** Rollback rate, in %, at which a rollout pauses itself. */
  rollout_pause_rollback_percent?: number;
  /** Crash rate, in %, at which a rollout pauses itself. */
  rollout_pause_crash_percent?: number;
  /**
   * Who hears about this app's support tickets in the website's bell: whoever turned `support` on,
   * until somebody takes them over. Optional so a service that predates tickets still renders.
   */
  support_assignee_email?: string | null;
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
  log_level?: LogLevel;
  screenshots_enabled?: boolean;
  /** Validated by the service (400 when it is not a 32-byte Ed25519 key); null clears it. */
  release_public_key?: string | null;
  update_health_timeout_seconds?: number;
  update_max_failures?: number;
  rollout_pause_rollback_percent?: number;
  rollout_pause_crash_percent?: number;
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
  /** Whether the device holds the live connection right now (socket presence only). */
  socket_connected?: boolean;
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
  /** Null follows the app's `log_level`. */
  log_level_override: LogLevel | null;
  effective_log_level: LogLevel;
  /** This device's own consent; a screenshot also needs the app's. */
  screenshots_enabled: boolean;
  /** The app's switch and this device's, both on. */
  screenshots_allowed: boolean;
  presence_mode: PresenceMode;
  socket_connected_at: string | null;
  socket_closed_at: string | null;
};

export type InstallationPayload = {
  alias?: string | null;
  channel?: Channel;
  state_override?: AppState | null;
  state_message?: string | null;
  log_level_override?: LogLevel | null;
  screenshots_enabled?: boolean;
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

/**
 * One heartbeat as the service received it — the audit record behind the charts, which only keep
 * the last heartbeat of each minute.
 */
export type HeartbeatEntry = {
  id: number;
  received_at: string;
  ip: string | null;
  app_version: string | null;
  /** What the device said it was used for since its previous heartbeat. */
  active_seconds: number | null;
  /** What the service actually counted as online: zero after a gap past the offline threshold. */
  credited_seconds: number;
  snapshot: Snapshot | null;
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

/* ── Remote operation ─────────────────────────────────────────────────── */

export type Command = {
  id: string;
  type: CommandType;
  payload: Record<string, unknown> | null;
  status: CommandStatus;
  created_at: string;
  expires_at: string;
  delivered_at: string | null;
  completed_at: string | null;
  /** What the device answered when it finished, as it sent it. */
  result: unknown;
  created_by: string | null;
  cancelled_by: string | null;
  installation_id: string;
  app_id: string;
};

export type NewCommand = {
  type: CommandType;
  payload?: Record<string, unknown>;
  /** 60 to 604 800; the service's default is an hour. */
  expires_in_seconds?: number;
};

export type Screenshot = {
  id: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  command_id: string | null;
  /** Relative to the service's base, and behind the bearer token like everything else. */
  image_path: string;
};

export type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
  /** The logger, module or component the entry came from. */
  target: string | null;
  context: Record<string, unknown> | null;
  occurred_at: string;
  received_at: string;
  installation_id: string;
  installation_alias: string | null;
  installation_hostname: string | null;
};

export type LogQuery = {
  /** "At least this severe". */
  level?: LogLevel;
  search?: string;
  from?: string;
  to?: string;
  installation_id?: string;
  limit?: number;
  offset?: number;
};

export type FlagValue = boolean | string | number;

export type Flag = {
  id: string;
  key: string;
  description: string | null;
  scope: TargetScope;
  /** The channel name, or the installation id; null for the app scope. */
  scope_value: string | null;
  value: FlagValue;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type NewFlag = {
  key: string;
  value: FlagValue;
  description?: string | null;
  scope?: TargetScope;
  scope_value?: string | null;
};

export type FlagPayload = {value?: FlagValue; description?: string | null};

export type ConfigDocument = {
  app_id: string;
  /** 0 while nothing has been saved. */
  version: number;
  document: Record<string, unknown>;
  schema: Record<string, unknown> | null;
  note: string | null;
  created_at: string | null;
  created_by: string | null;
};

export type ConfigPayload = {
  document: Record<string, unknown>;
  /** An object replaces the schema, null removes it, and leaving it out keeps it. */
  schema?: Record<string, unknown> | null;
  note?: string | null;
  /** The version this edit started from; a stale one is refused with a 409. */
  base_version?: number;
};

export type ConfigVersion = {
  version: number;
  document: Record<string, unknown>;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

export type MessageStatus = "active" | "scheduled" | "ended";

export type AppMessage = {
  id: string;
  app_id?: string;
  title: string;
  body: string;
  severity: MessageSeverity;
  display: MessageDisplay;
  scope: TargetScope;
  scope_value: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: MessageStatus;
  /** How many installations have shown it. */
  seen_count: number;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type NewMessage = {
  title: string;
  body: string;
  severity?: MessageSeverity;
  display?: MessageDisplay;
  scope?: TargetScope;
  scope_value?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type MessagePayload = Partial<Omit<NewMessage, "scope" | "scope_value">>;

export type MessageReceipt = {
  installation_id: string;
  alias: string | null;
  hostname: string | null;
  device_id: string;
  seen_at: string;
};

export type CrashGroup = {
  id: string;
  /** Present on the single record; the list is already scoped to one app. */
  app_id?: string;
  signature: string;
  app_version: string | null;
  title: string;
  status: CrashStatus;
  occurrences: number;
  affected_installations: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type CrashReport = {
  id: string;
  installation_id: string;
  installation_alias: string | null;
  installation_hostname: string | null;
  app_version: string | null;
  kind: string | null;
  message: string | null;
  stack: string | null;
  context: Record<string, unknown> | null;
  occurred_at: string;
  received_at: string;
};

export type CrashQuery = {
  status?: CrashStatus;
  app_version?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type AlertRule = {
  id: string;
  /** Null watches every app. */
  app_id: string | null;
  app_name: string | null;
  name: string;
  kind: AlertKind;
  threshold: number;
  /** Minutes. Unused by `installation_offline`, whose threshold is itself a duration. */
  window_minutes: number;
  enabled: boolean;
  silenced_until: string | null;
  /** Who the notification centre tells when it fires. */
  notify_email: string | null;
  open_alerts: number;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type NewAlertRule = {
  app_id?: string | null;
  name: string;
  kind: AlertKind;
  threshold: number;
  window_minutes?: number;
  enabled?: boolean;
};

export type AlertRulePayload = {
  name?: string;
  threshold?: number;
  window_minutes?: number;
  enabled?: boolean;
  silenced_until?: string | null;
  /** Makes the account saving it the one notified. */
  notify_me?: true;
};

export type AlertQueryStatus = AlertStatus | "unresolved";

export type AlertEntry = {
  id: string;
  /** Null once the rule was deleted; the alert stays as history with its rule's last name and kind. */
  rule_id: string | null;
  rule_name: string | null;
  rule_deleted: boolean;
  kind: AlertKind;
  app_id: string | null;
  app_name: string | null;
  installation_id: string | null;
  /** What the alert is about — an installation, an app — as an id and a readable name. */
  subject: string | null;
  subject_name: string | null;
  status: AlertStatus;
  value: number | null;
  /** Null when the rule was deleted. */
  threshold: number | null;
  details: Record<string, unknown> | null;
  occurrences: number;
  opened_at: string;
  last_triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  notified_at: string | null;
};

export type AlertQuery = {
  status?: AlertQueryStatus;
  app_id?: string;
  rule_id?: string;
  installation_id?: string;
  limit?: number;
  offset?: number;
};

/* ── Releases ─────────────────────────────────────────────────────────── */

/** What CI uploads releases with. Only its first characters are ever shown again. */
export type CiToken = {
  id: string;
  app_id: string;
  label: string | null;
  /** `cic_…`, the first characters of the token. */
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_by: string | null;
  created_at: string;
};

/** The answer to creating a token: the only time `token` is ever shown. */
export type NewCiToken = CiToken & {token: string};

/**
 * Who changed a release's status last, and why. A person's change carries `by` and an optional
 * `reason`; an automatic pause carries `automatic: true`, which rate crossed which threshold and over
 * how many devices; a line rolled back carries the version it went back to.
 */
export type ReleaseStatusReason = {
  by?: string | null;
  automatic?: boolean;
  reason?: string | null;
  rate?: number;
  threshold?: number;
  sample?: number;
  rolled_back_to?: string;
  [key: string]: unknown;
};

export type Release = {
  id: string;
  app_id: string;
  /** Semantic version. One per line: app, channel, platform and architecture. */
  version: string;
  channel: Channel;
  platform: Platform;
  arch: Arch;
  status: ReleaseStatus;
  /** 0–100: the share of the line offered it, by a stable per-device bucket. */
  rollout_percent: number;
  /** Installations offered it whatever the percentage says. */
  rollout_installations: string[];
  /** Devices below it must update before they carry on. */
  min_version: string | null;
  notes: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  /** Hex. */
  sha256: string;
  /** Ed25519 over the raw SHA-256 digest, base64. */
  signature: string;
  /** `ci:<tokenId>`. */
  uploaded_by: string | null;
  published_at: string | null;
  published_by: string | null;
  status_reason: ReleaseStatusReason | null;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A row of the release list: the release and how many devices got how far with it. */
export type ReleaseListItem = Release & {
  installed_count: number;
  healthy_count: number;
  rolled_back_count: number;
};

/** Distinct devices that ever reported each step, and the two rates the automatic pause reads. */
export type ReleaseStats = {
  downloaded: number;
  installed: number;
  health_ok: number;
  rolled_back: number;
  failed: number;
  /** Devices that crashed on this version since it was published. */
  crashed: number;
  /** Percent of devices that settled (healthy or rolled back) and rolled back; null with none. */
  rollback_rate: number | null;
  /** Percent of devices that installed it and crashed on it; null with none. */
  crash_rate: number | null;
};

export type ReleaseDetail = Release & {
  stats: ReleaseStats;
  /** Active installations on the release's line. */
  installations_on_line: number;
  /** Of those, the ones already running this version. */
  installations_on_version: number;
};

export type ReleaseQuery = {
  channel?: Channel;
  platform?: Platform;
  arch?: Arch;
  status?: ReleaseStatus;
  limit?: number;
  offset?: number;
};

export type ReleasePayload = {
  notes?: string | null;
  min_version?: string | null;
  installation_ids?: string[];
};

export type RolloutPayload = {rollout_percent?: number; installation_ids?: string[]};

export type ReleaseReport = {
  id: number;
  release_id: string;
  installation_id: string;
  installation_alias: string | null;
  installation_hostname: string | null;
  status: UpdateReportStatus;
  /** The version the device was running when it started. */
  from_version: string | null;
  detail: string | null;
  created_at: string;
  /** Present on an installation's own report list, which crosses releases. */
  version?: string;
};

/** What a device would be offered right now, exactly as the device reads it. */
export type UpdateOffer = {
  release_id: string;
  version: string;
  channel: Channel;
  platform: Platform;
  arch: Arch;
  filename: string;
  size_bytes: number;
  sha256: string;
  signature: string;
  notes: string | null;
  min_version: string | null;
  /** The device is below the release's minimum version: it has to update before it carries on. */
  mandatory: boolean;
  /** The device runs a withdrawn version and is being sent back to an earlier one. */
  rollback: boolean;
  published_at: string | null;
  health_check_timeout_seconds: number;
  max_failures: number;
};

/** One installation's updater: its current offer, and a page of its reports. */
export type InstallationUpdates = {
  code: number;
  data: {offer: UpdateOffer | null; reports: ReleaseReport[]};
  pagination: {limit: number; offset: number; total: number};
};

/* ── Contracts, cycles and the work log ───────────────────────────────── */

/** Minutes carried into a cycle from an earlier one. */
export type CarriedBucket = {
  /** Start (`YYYY-MM-DD`) of the cycle these minutes were included in. */
  from: string;
  minutes: number;
  /** Cycles they have been carried for: 1 in the cycle right after the one they came from. */
  age: number;
};

/**
 * One hours cycle of a contract. Every figure is whole minutes. `ends_on` is **exclusive** — the
 * first day of the next cycle — so a cycle is shown as `starts_on – (ends_on − 1 day)`.
 */
export type Cycle = {
  id: string;
  contract_id: string;
  starts_on: string;
  ends_on: string;
  status: CycleStatus;
  included_minutes: number;
  carried_minutes: number;
  carried: CarriedBucket[];
  available_minutes: number;
  used_minutes: number;
  /** Negative once the cycle is over budget. */
  remaining_minutes: number;
  overage_minutes: number;
  /** In the contract's currency: an estimate at its rate while open, final once closed. */
  overage_amount: number | null;
  /** Unused minutes the rollover policy let go when the cycle closed. */
  expired_minutes: number | null;
  closed_at: string | null;
  /** Null when the service closed it on its own. */
  closed_by: string | null;
  billed_at: string | null;
  billed_by: string | null;
  billing_reference: string | null;
};

export type CycleDetail = Cycle & {
  contract: {id: string; name: string; currency: Currency; overage_rate: number};
  work_logs: WorkLogEntry[];
};

export type ContractApp = {id: string; name: string; state: AppState};

export type Contract = {
  id: string;
  company_id: string;
  company: CompanyRef | null;
  name: string;
  amount: number;
  currency: Currency;
  billing_period: BillingPeriod;
  /** `YYYY-MM-DD`, the first day covered. */
  starts_on: string;
  /** `YYYY-MM-DD`, the last day covered (inclusive); null for open-ended. */
  ends_on: string | null;
  auto_renew: boolean;
  /** Months an auto-renewing contract is extended by when it reaches its end. */
  renewal_months: number;
  /** Days before the end the client is told. */
  notice_days: number;
  cycle_period: CyclePeriod;
  included_minutes: number;
  rollover_enabled: boolean;
  rollover_max_minutes: number | null;
  rollover_max_cycles: number | null;
  /** Per hour over the cycle's budget, in `currency`. */
  overage_rate: number;
  grace_days: number;
  grace_allows: GraceAllowance[];
  grace_message: string | null;
  status: ContractStatus;
  /** Days from today to `ends_on`; null when open-ended or cancelled. */
  days_left: number | null;
  /** Ends within its notice period without renewing itself. */
  expiring: boolean;
  notice_sent_at: string | null;
  lapsed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  /** Why it was cancelled, when somebody said. */
  cancel_reason: string | null;
  notes: string | null;
  apps: ContractApp[];
  /** The cycle running today, or null before the contract starts. */
  current_cycle: Cycle | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type ContractDetail = Contract & {
  /** Minutes of the current cycle per app; a null app is work about the company as a whole. */
  current_cycle_usage_by_app: Array<{app_id: string | null; app_name: string | null; minutes: number}>;
};

export type ContractPayload = {
  name?: string;
  amount?: number;
  currency?: Currency;
  billing_period?: BillingPeriod;
  starts_on?: string;
  ends_on?: string | null;
  auto_renew?: boolean;
  renewal_months?: number;
  notice_days?: number;
  cycle_period?: CyclePeriod;
  included_minutes?: number;
  rollover_enabled?: boolean;
  rollover_max_minutes?: number | null;
  rollover_max_cycles?: number | null;
  overage_rate?: number;
  grace_days?: number;
  grace_allows?: GraceAllowance[];
  grace_message?: string | null;
  notes?: string | null;
  /** Replaces the covered apps. */
  app_ids?: string[];
};

export type NewContract = ContractPayload & {company_id: string; name: string; starts_on: string};

export type ContractQuery = {
  company_id?: string;
  app_id?: string;
  status?: ContractStatus;
  limit?: number;
  offset?: number;
};

export type WorkLogEntry = {
  id: string;
  company_id: string;
  company_name: string | null;
  /** Null for work about the company as a whole. */
  app_id: string | null;
  app_name: string | null;
  /** Null for work outside any contract. */
  contract_id: string | null;
  contract_name: string | null;
  cycle_id: string | null;
  /** False once its cycle is closed: its balance is final. */
  editable: boolean;
  occurred_on: string;
  minutes: number;
  kind: WorkKind;
  description: string;
  link_url: string | null;
  /** The support ticket the work answered. Optional so a service that predates tickets still renders. */
  ticket_id?: string | null;
  ticket_number?: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type WorkLogPayload = {
  app_id?: string | null;
  /** Chooses the contract when several cover the day; null lets the service pick. */
  contract_id?: string | null;
  occurred_on?: string;
  minutes?: number;
  kind?: WorkKind;
  description?: string;
  link_url?: string | null;
  /** A ticket of the same company (422 otherwise); null unlinks it. */
  ticket_id?: string | null;
};

export type NewWorkLog = WorkLogPayload & {
  company_id?: string;
  occurred_on: string;
  minutes: number;
  kind: WorkKind;
  description: string;
};

export type WorkLogQuery = {
  company_id?: string;
  app_id?: string;
  contract_id?: string;
  cycle_id?: string;
  ticket_id?: string;
  kind?: WorkKind;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

/** A page of the work log, with the minutes of everything the filters match. */
export type WorkLogPage = Page<WorkLogEntry> & {totals: {minutes: number}};

/* ── Support tickets ──────────────────────────────────────────────────── */

/**
 * What the device looked like when the ticket was opened, kept with the ticket so it never drifts.
 * `logs` are the latest entries as lines, oldest first, and `crashes` the open crash groups of the
 * running version as `title (×n)` — both empty unless the app has the module and the requester
 * attached diagnostics.
 */
export type TicketContext = {
  installation?: {
    name?: string | null;
    device_id?: string | null;
    app_version?: string | null;
    channel?: string | null;
    platform?: string | null;
    os?: string | null;
    arch?: string | null;
    last_seen_at?: string | null;
  };
  logs?: string[];
  crashes?: string[];
};

export type TicketMessage = {
  id: string;
  /** `requester` wrote it from the app; `staff` answered from this panel. */
  author: "requester" | "staff";
  author_name: string | null;
  body: string;
  /** When the other side opened it. */
  seen_at: string | null;
  created_at: string;
};

export type Ticket = {
  id: string;
  /** Sequential, for `#42` in conversation and in the search box. */
  number: number;
  app_id: string;
  app_name: string | null;
  company_id: string;
  company_name: string | null;
  /** Null once the installation is gone. */
  installation_id: string | null;
  installation_name: string | null;
  subject: string;
  status: TicketStatus;
  requester_name: string | null;
  requester_email: string | null;
  context: TicketContext | null;
  last_message_at: string | null;
  /** Whose turn it is. */
  last_message_by: "requester" | "staff" | null;
  /** Requester messages nobody in the panel has opened yet. */
  unread: number;
  /** Work logged against the ticket, in minutes. */
  logged_minutes: number;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  /** Present on one ticket and on the answer to a reply. */
  messages?: TicketMessage[];
};

/** Work logged against the ticket, in the same shape the work log routes answer. */
export type TicketDetail = Ticket & {messages: TicketMessage[]; work_logs: WorkLogEntry[]};

export type TicketQuery = {
  status?: TicketStatusFilter;
  app_id?: string;
  company_id?: string;
  installation_id?: string;
  /** Subject, requester name or address — or `#42` (or `42`) for a number. */
  search?: string;
  limit?: number;
  offset?: number;
};

export type TicketReply = {message: string; status?: ReplyStatus};

export type TicketPayload = {status?: TicketStatus; subject?: string};

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
  /** Optional so a service that predates alerts still renders. */
  alerts?: {unresolved: number};
  /** Rolling out means published below 100 %. Optional for the same reason. */
  releases?: {rolling_out: number; paused: number; drafts: number};
  /** Optional for the same reason. `expiring` ends within its notice period without renewing. */
  contracts?: {active: number; expiring: number; in_grace: number};
  /** Open cycles over budget, and closed cycles with overage not billed yet. */
  cycles?: {exceeded: number; to_bill: number};
  /** Tickets waiting on us and on the client, and requester messages nobody opened. Optional likewise. */
  tickets?: {open: number; pending: number; unread: number};
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
