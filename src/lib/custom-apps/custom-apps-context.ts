import {createContext, useContext} from "react";
import {
  ALERT_KINDS,
  ALERT_STATUSES,
  APP_KINDS,
  APP_MODULES,
  APP_STATES,
  CHANNELS,
  COMMAND_STATUSES,
  COMMAND_TYPES,
  CONTACT_ROLES,
  CRASH_STATUSES,
  DEFAULT_TIMEZONE,
  GRACE_MAX_DAYS,
  LOG_LEVELS,
  MESSAGE_DISPLAYS,
  MESSAGE_SEVERITIES,
  PLATFORMS,
  PRESENCE_MODES,
  TARGET_SCOPES,
} from "@/lib/custom-apps/types.ts";
import type {Account, ServiceStatus} from "@/lib/custom-apps/types.ts";

export type CustomAppsContextValue = {
  /** Who is signed in *here*, as the service sees them, or null while that is unknown. */
  account: Account | null;
  /**
   * What `GET /` said: the vocabularies, the ingest base and the heartbeat bounds. Null when the
   * probe failed — the panel works without it, on the vocabulary compiled into this bundle.
   */
  service: ServiceStatus | null;
  loading: boolean;
  /** True when the service answered 403: a live session the service does not let in. */
  forbidden: boolean;
  error: string | null;
  reload: () => void;
};

export const CustomAppsContext = createContext<CustomAppsContextValue | null>(null);

/**
 * Whether this account may use the panel at all, asked once above the whole signed-in subtree —
 * an account the service refuses would otherwise meet every screen failing with its own 403.
 */
export const useCustomApps = () => {
  const value = useContext(CustomAppsContext);
  if (!value) throw new Error("useCustomApps must be used inside the custom-apps panel");
  return value;
};

/** Heartbeat bounds used until the service states its own, in seconds. */
const HEARTBEAT_FALLBACK = {min: 15, max: 3600, default: 60};

/**
 * The service's vocabularies, or this bundle's copy of them when the service did not say.
 *
 * Preferring the served lists is what lets a new kind of app, a new command or a new alert kind
 * appear in these forms without a release on this side.
 */
export const useServiceVocabulary = () => {
  const {service} = useCustomApps();

  return {
    kinds: service?.kinds?.length ? service.kinds : [...APP_KINDS],
    platforms: service?.platforms?.length ? service.platforms : [...PLATFORMS],
    states: service?.states?.length ? service.states : [...APP_STATES],
    channels: service?.channels?.length ? service.channels : [...CHANNELS],
    presenceModes: service?.presence_modes?.length ? service.presence_modes : [...PRESENCE_MODES],
    modules: service?.modules?.length ? service.modules : [...APP_MODULES],
    contactRoles: service?.contact_roles?.length ? service.contact_roles : [...CONTACT_ROLES],
    heartbeat: service?.heartbeat_interval ?? HEARTBEAT_FALLBACK,
    offlineAfter: service?.offline_after_intervals ?? 3,
    rawRetentionDays: service?.retention?.raw_days ?? 30,
    timezone: service?.timezone || DEFAULT_TIMEZONE,
    ingestBaseUrl: service?.ingest_base_url ?? null,
    logLevels: service?.log_levels?.length ? service.log_levels : [...LOG_LEVELS],
    commandTypes: service?.command_types?.length ? service.command_types : [...COMMAND_TYPES],
    commandStatuses: service?.command_statuses?.length ? service.command_statuses : [...COMMAND_STATUSES],
    targetScopes: service?.target_scopes?.length ? service.target_scopes : [...TARGET_SCOPES],
    messageSeverities: service?.message_severities?.length ? service.message_severities : [...MESSAGE_SEVERITIES],
    messageDisplays: service?.message_displays?.length ? service.message_displays : [...MESSAGE_DISPLAYS],
    crashStatuses: service?.crash_statuses?.length ? service.crash_statuses : [...CRASH_STATUSES],
    alertKinds: service?.alert_kinds?.length ? service.alert_kinds : [...ALERT_KINDS],
    alertStatuses: service?.alert_statuses?.length ? service.alert_statuses : [...ALERT_STATUSES],
    graceMaxDays: service?.grace_max_days ?? GRACE_MAX_DAYS,
    screenshotMaxBytes: service?.screenshot_max_bytes ?? null,
  };
};
