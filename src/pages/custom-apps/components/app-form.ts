import {orNull} from "@/lib/admin/format.ts";
import type {App, AppKind, AppModule, AppPayload, LogLevel, NewApp, OperatingHours, PresenceMode} from "@/lib/custom-apps/types.ts";
import {tidyHours, validateHours} from "@/pages/custom-apps/components/operating-hours.ts";

/**
 * An app as its forms hold it, shared by the create screen and the Settings tab: the shape, the
 * conversion from the service's record, and the checks run before either one saves.
 */

export const APP_NAME_MAX = 120;

export type AppForm = {
  companyId: string;
  name: string;
  kind: AppKind;
  description: string;
  domain: string;
  repositoryUrl: string;
  presenceMode: PresenceMode;
  /** Kept as text so the field can be emptied mid-edit. */
  heartbeat: string;
  modules: AppModule[];
  hours: OperatingHours | null;
  logLevel: LogLevel;
  /** Off until the client's contract allows them (ley 21.719). */
  screenshots: boolean;
};

export type AppFormField = keyof AppForm;
export type AppFormErrors = Partial<Record<AppFormField, string>>;

export const emptyAppForm = (heartbeat: number, companyId = ""): AppForm => ({
  companyId,
  name: "",
  kind: "web",
  description: "",
  domain: "",
  repositoryUrl: "",
  presenceMode: "ping",
  heartbeat: String(heartbeat),
  modules: ["metrics", "events"],
  hours: null,
  logLevel: "info",
  screenshots: false,
});

export const appToForm = (app: App): AppForm => ({
  companyId: app.company_id,
  name: app.name,
  kind: app.kind,
  description: app.description ?? "",
  domain: app.domain ?? "",
  repositoryUrl: app.repository_url ?? "",
  presenceMode: app.presence_mode,
  heartbeat: String(app.heartbeat_interval_seconds),
  modules: app.modules ?? [],
  hours: tidyHours(app.operating_hours),
  logLevel: app.log_level ?? "info",
  screenshots: app.screenshots_enabled ?? false,
});

/** A bare hostname: no scheme, no path, no port. The service compares it against `Origin`. */
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** The slice of `t` the validation needs, so any namespace's translator can be handed in. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

export const validateAppForm = (
  form: AppForm,
  t: Translate,
  heartbeat: {min: number; max: number},
): AppFormErrors => {
  const found: AppFormErrors = {};
  if (!form.companyId) found.companyId = t("custom_apps:validation.required");

  const name = form.name.trim();
  if (!name) found.name = t("custom_apps:validation.required");
  else if (name.length > APP_NAME_MAX) found.name = t("custom_apps:validation.too_long", {max: APP_NAME_MAX});

  if (form.domain.trim() && !HOSTNAME.test(form.domain.trim())) found.domain = t("custom_apps:apps.invalid_domain");

  const repository = form.repositoryUrl.trim();
  if (repository) {
    try {
      const url = new URL(repository);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
    } catch {
      found.repositoryUrl = t("custom_apps:apps.invalid_url");
    }
  }

  const seconds = Number(form.heartbeat);
  if (!Number.isInteger(seconds) || seconds < heartbeat.min || seconds > heartbeat.max) {
    found.heartbeat = t("custom_apps:apps.heartbeat_range", {min: heartbeat.min, max: heartbeat.max});
  }

  if (form.hours && !form.hours.timezone.trim()) found.hours = t("custom_apps:validation.required");
  else if (Object.keys(validateHours(form.hours)).length > 0) found.hours = t("custom_apps:hours.invalid");

  return found;
};


/** Every field as the service takes it. The create screen sends this whole. */
export const appFormPayload = (form: AppForm) => ({
  company_id: form.companyId,
  name: form.name.trim(),
  kind: form.kind,
  description: orNull(form.description),
  domain: orNull(form.domain.toLowerCase()),
  repository_url: orNull(form.repositoryUrl),
  presence_mode: form.presenceMode,
  heartbeat_interval_seconds: Number(form.heartbeat),
  modules: form.modules,
  operating_hours: tidyHours(form.hours),
  log_level: form.logLevel,
  screenshots_enabled: form.screenshots,
});

/**
 * Only the fields that differ from `baseline`, for a PATCH. Compared as the service would store
 * them, so retyping a value identically — or reordering two windows — is not a change. The lists
 * and the schedule go up whole: the service replaces them rather than merging.
 */
export const appFormChanges = (form: AppForm, baseline: AppForm): AppPayload => {
  const next = appFormPayload(form);
  const before = appFormPayload(baseline);
  const changed: AppPayload = {};
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) {
      (changed as Record<string, unknown>)[key] = next[key];
    }
  }
  return changed;
};

/**
 * A new app's body. The presence mode, the log level and the screenshot switch are left out: a new
 * app takes the service's defaults — pings, `info`, and no screenshots — and each is a decision made
 * later, in Settings, once the app and its contract exist.
 */
export const newAppPayload = (form: AppForm): NewApp => {
  const {presence_mode: _presence, log_level: _level, screenshots_enabled: _screenshots, ...body} = appFormPayload(form);
  return body;
};
