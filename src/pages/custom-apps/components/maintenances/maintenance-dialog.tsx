import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk, ShieldWarning, Wrench} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {FieldLegend, RequiredLegend} from "@/components/ui/help.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatMinutes} from "@/lib/custom-apps/format.ts";
import {MAINTENANCE_TEXT_LIMITS} from "@/lib/custom-apps/types.ts";
import type {InstallationSummary, Maintenance, MaintenanceKind, MaintenancePayload, NewMaintenance, ReleaseListItem} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {FormSection} from "@/pages/custom-apps/components/form-section.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";
import {joinMinutes, splitMinutes} from "@/pages/custom-apps/components/maintenances/maintenance-format.ts";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";
import {useAppInstallations} from "@/pages/custom-apps/components/use-app-installations.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

type Form = {
  kind: MaintenanceKind;
  title: string;
  description: string;
  hours: string;
  minutes: string;
  releaseId: string;
  /** `all`: every active installation; `pick`: the ones in `installationIds`. */
  scope: "all" | "pick";
  installationIds: string[];
};

type FieldName = "title" | "description" | "duration" | "installations";

const formOf = (maintenance: Maintenance | null): Form => {
  const duration = splitMinutes(maintenance?.estimated_minutes ?? 60);
  return {
    kind: maintenance?.kind ?? "normal",
    title: maintenance?.title ?? "",
    description: maintenance?.description ?? "",
    hours: duration.hours,
    minutes: duration.minutes,
    releaseId: maintenance?.release_id ?? "",
    scope: maintenance && !maintenance.all_installations ? "pick" : "all",
    installationIds: maintenance?.installation_ids ?? [],
  };
};

/** The service's architecture aliases, so a device reporting `amd64` reads as on an `x86_64` line. */
const ARCH_ALIASES: Record<string, string> = {
  x86_64: "x86_64",
  amd64: "x86_64",
  x64: "x86_64",
  aarch64: "aarch64",
  arm64: "aarch64",
  x86: "x86",
  i386: "x86",
  i686: "x86",
  armv7: "armv7",
  armv7l: "armv7",
  armeabi_v7a: "armv7",
  "armeabi-v7a": "armv7",
};

/** Whether a release's line reaches an installation — the service's `onReleaseLine`, mirrored. */
const onLine = (release: Pick<ReleaseListItem, "channel" | "platform" | "arch">, installation: InstallationSummary) => {
  if (release.channel !== installation.channel || release.platform !== installation.platform) return false;
  if (release.arch === "any" || release.arch === "universal") return true;
  return ARCH_ALIASES[(installation.arch ?? "").trim().toLowerCase()] === release.arch;
};

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

/**
 * Planning a maintenance of one app, or correcting one that is still a draft (or went unanswered):
 * what kind it is, what will be done — in words the client reads —, how long it takes, the release it
 * installs and on which installations.
 *
 * The windows it is offered in are not part of this form: they live on the maintenance's page, where
 * the suggestions and the heatmap are. Saving a new one creates a draft and nothing else — nobody is
 * emailed until the page sends it.
 *
 * A release can only reach the installations on its line (channel, platform, architecture), and the
 * service refuses a named installation that is not on it; the list says which ones are off the line
 * instead of letting the save fail.
 */
export const MaintenanceDialog = ({
  open,
  appId,
  maintenance,
  onClose,
  onSaved,
}: {
  open: boolean;
  appId: string;
  /** Null creates one. */
  maintenance: Maintenance | null;
  onClose: () => void;
  onSaved: (maintenance: Maintenance) => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {maintenanceKinds, maintenanceLimits} = useServiceVocabulary();
  const [form, setForm] = useState<Form>(() => formOf(maintenance));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [search, setSearch] = useState("");

  const installations = useAppInstallations(appId);
  const releases = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.releases.list(appId, {limit: 200}, signal), [appId]),
  );

  /* Draft and published releases can be installed by a maintenance; paused and withdrawn cannot. */
  const releaseOptions = useMemo(() => {
    const rows = (releases.data?.data ?? []).filter((row) => row.status === "draft" || row.status === "published");
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [releases.data]);
  const release = releaseOptions.find((row) => row.id === form.releaseId) ?? null;

  const candidates = useMemo(
    () =>
      (installations.data?.data ?? [])
        .filter((row) => row.status === "active" || form.installationIds.includes(row.id))
        .sort((a, b) => installationLabel(a).localeCompare(installationLabel(b))),
    [installations.data, form.installationIds],
  );
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? candidates.filter((row) =>
        [installationLabel(row), row.hostname, row.app_version, row.arch, row.channel].some((value) => value?.toLowerCase().includes(needle)),
      )
    : candidates;

  const save = useMutation(
    useCallback(
      (body: {create?: NewMaintenance; update?: MaintenancePayload}) =>
        maintenance && body.update
          ? customAppsApi.maintenances.update(maintenance.id, body.update)
          : customAppsApi.maintenances.create(appId, body.create as NewMaintenance),
      [appId, maintenance],
    ),
  );

  const {reset} = save;
  useEffect(() => {
    if (!open) return;
    setForm(formOf(maintenance));
    setErrors({});
    setSearch("");
    reset();
  }, [open, maintenance, reset]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors({});
  };

  const toggle = (id: string, checked: boolean) =>
    set("installationIds", checked ? [...new Set([...form.installationIds, id])] : form.installationIds.filter((value) => value !== id));

  const minutes = joinMinutes(form.hours, form.minutes);
  const offLine = release ? form.installationIds.filter((id) => {
    const row = candidates.find((candidate) => candidate.id === id);
    return row ? !onLine(release, row) : false;
  }) : [];

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const title = form.title.trim();
    if (!title) found.title = t("custom_apps:validation.required");
    else if (title.length > MAINTENANCE_TEXT_LIMITS.maxTitleLength) found.title = t("custom_apps:validation.too_long", {max: MAINTENANCE_TEXT_LIMITS.maxTitleLength});
    const description = form.description.trim();
    if (!description) found.description = t("custom_apps:validation.required");
    else if (description.length > MAINTENANCE_TEXT_LIMITS.maxDescriptionLength) {
      found.description = t("custom_apps:validation.too_long", {max: MAINTENANCE_TEXT_LIMITS.maxDescriptionLength});
    }
    if (!Number.isFinite(minutes) || minutes < maintenanceLimits.min_estimated_minutes || minutes > maintenanceLimits.max_estimated_minutes) {
      found.duration = t("custom_apps:maintenances.errors.duration", {
        min: maintenanceLimits.min_estimated_minutes,
        max: maintenanceLimits.max_estimated_minutes / 60,
      });
    }
    if (form.scope === "pick" && form.installationIds.length === 0) found.installations = t("custom_apps:maintenances.errors.pick_one");
    else if (form.scope === "pick" && offLine.length > 0) found.installations = t("custom_apps:maintenances.errors.off_line", {count: offLine.length});
    return found;
  };

  const installationIds = form.scope === "all" ? [] : form.installationIds;

  const createBody = (): NewMaintenance => ({
    kind: form.kind,
    title: form.title.trim(),
    description: form.description.trim(),
    estimated_minutes: minutes,
    release_id: form.releaseId || null,
    installation_ids: installationIds,
  });

  /** Only what changed: a longer duration is checked against every window, so an untouched one must not travel. */
  const updateBody = (current: Maintenance): MaintenancePayload => {
    const body: MaintenancePayload = {};
    if (form.kind !== current.kind) body.kind = form.kind;
    if (form.title.trim() !== current.title) body.title = form.title.trim();
    if (form.description.trim() !== current.description) body.description = form.description.trim();
    if (minutes !== current.estimated_minutes) body.estimated_minutes = minutes;
    if ((form.releaseId || null) !== current.release_id) body.release_id = form.releaseId || null;
    if (!same(installationIds, current.installation_ids)) body.installation_ids = installationIds;
    return body;
  };

  const describeFailure = (status: number | null, message: string) => {
    if (status === 409) return t("custom_apps:maintenances.errors.not_editable");
    if (status === 422 && /estimated_minutes/i.test(message)) return t("custom_apps:maintenances.errors.window_too_short");
    if (status === 422 && /release/i.test(message) && /line/i.test(message)) return t("custom_apps:maintenances.errors.off_line_service", {detail: message});
    if (status === 422 && /release/i.test(message)) return t("custom_apps:maintenances.errors.release");
    if (status === 422 && /installation/i.test(message)) return t("custom_apps:maintenances.errors.installations");
    return t(`admin:errors.${message}`, {defaultValue: message});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    let payload: {create?: NewMaintenance; update?: MaintenancePayload};
    if (maintenance) {
      const update = updateBody(maintenance);
      if (Object.keys(update).length === 0) {
        onClose();
        return;
      }
      payload = {update};
    } else {
      payload = {create: createBody()};
    }
    const outcome = await save.run(payload);
    if (outcome.ok) onSaved(outcome.data);
  };

  const pending = save.pending;
  const durationHelp = {min: maintenanceLimits.min_estimated_minutes, max: maintenanceLimits.max_estimated_minutes / 60};

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={maintenance ? t("custom_apps:maintenances.edit_title") : t("custom_apps:maintenances.create_title")}
      className="max-w-2xl"
      help={help.form(maintenance ? "maintenances.form_help_edit" : "maintenances.form_help_create", {
        lead: maintenanceLimits.min_lead_hours,
        resend: maintenanceLimits.resend_after_hours,
      })}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <RequiredLegend className="-mt-2" />

        <FormSection title={t("custom_apps:maintenances.sections.what")}>
          <fieldset className="flex flex-col gap-1.5">
            <FieldLegend label={t("custom_apps:maintenances.fields.kind")} help={help.field("maintenances.help.kind")} required />
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {maintenanceKinds.map((kind) => {
                const id = `maintenance-kind-${kind}`;
                const checked = form.kind === kind;
                const Icon = kind === "security" ? ShieldWarning : Wrench;
                return (
                  <label
                    key={kind}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
                      checked
                        ? kind === "security"
                          ? "border-red-500/50 bg-red-500/5"
                          : "border-accent-700 bg-accent-900/30"
                        : "border-neutral-800 hover:border-neutral-700",
                      pending && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="maintenance-kind"
                      value={kind}
                      checked={checked}
                      disabled={pending}
                      onChange={() => set("kind", kind)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm text-text">
                        <Icon size={15} aria-hidden="true" className={kind === "security" ? "text-red-300" : "text-neutral-400"} />
                        {t(`custom_apps:maintenance_kinds.${kind}`, {defaultValue: kind})}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                        {t(`custom_apps:maintenance_kinds_hint.${kind}`, {defaultValue: ""})}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field
            label={t("custom_apps:maintenances.fields.title")}
            htmlFor="maintenance-title"
            error={errors.title}
            hint={t("custom_apps:maintenances.hints.title")}
            help={help.field("maintenances.help.title")}
            required
          >
            <Input
              id="maintenance-title"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              maxLength={MAINTENANCE_TEXT_LIMITS.maxTitleLength}
              disabled={pending}
              aria-invalid={Boolean(errors.title)}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            label={t("custom_apps:maintenances.fields.description")}
            htmlFor="maintenance-description"
            error={errors.description}
            hint={t("custom_apps:maintenances.hints.description")}
            help={help.field("maintenances.help.description")}
            required
          >
            <Textarea
              id="maintenance-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              maxLength={MAINTENANCE_TEXT_LIMITS.maxDescriptionLength}
              rows={5}
              disabled={pending}
              aria-invalid={Boolean(errors.description)}
              className="resize-y"
              required
            />
          </Field>

          <fieldset className="flex flex-col gap-1.5">
            <FieldLegend label={t("custom_apps:maintenances.fields.duration")} help={help.field("maintenances.help.duration", durationHelp)} required />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={Math.floor(maintenanceLimits.max_estimated_minutes / 60)}
                value={form.hours}
                onChange={(event) => set("hours", event.target.value)}
                disabled={pending}
                aria-label={t("custom_apps:maintenances.fields.hours")}
                aria-invalid={Boolean(errors.duration)}
                className="w-20 font-mono"
              />
              <span className="text-sm text-neutral-500">h</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={5}
                value={form.minutes}
                onChange={(event) => set("minutes", event.target.value)}
                disabled={pending}
                aria-label={t("custom_apps:maintenances.fields.minutes")}
                aria-invalid={Boolean(errors.duration)}
                className="w-20 font-mono"
              />
              <span className="text-sm text-neutral-500">min</span>
              {Number.isFinite(minutes) && minutes > 0 && (
                <span className="text-[12px] text-neutral-500">= {formatMinutes(minutes)}</span>
              )}
            </div>
            {errors.duration ? (
              <p className="text-xs text-red-400">{errors.duration}</p>
            ) : (
              <p className="text-xs text-neutral-500">{t("custom_apps:maintenances.hints.duration", durationHelp)}</p>
            )}
          </fieldset>
        </FormSection>

        <FormSection title={t("custom_apps:maintenances.sections.where")}>
          <Field
            label={t("custom_apps:maintenances.fields.release")}
            htmlFor="maintenance-release"
            hint={
              releases.error
                ? t("custom_apps:maintenances.hints.release_unavailable")
                : releaseOptions.length === 0 && !releases.loading
                  ? t("custom_apps:maintenances.hints.release_none")
                  : t("custom_apps:maintenances.hints.release")
            }
            help={help.field("maintenances.help.release")}
          >
            <Select
              id="maintenance-release"
              value={form.releaseId}
              onChange={(event) => set("releaseId", event.target.value)}
              disabled={pending || (releases.loading && !releases.data)}
            >
              <option value="">{releases.loading && !releases.data ? t("admin:common.loading") : t("custom_apps:maintenances.no_release")}</option>
              {releaseOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {t("custom_apps:maintenances.release_option", {
                    version: row.version,
                    channel: t(`custom_apps:channels.${row.channel}`, {defaultValue: row.channel}),
                    platform: t(`custom_apps:platforms.${row.platform}`, {defaultValue: row.platform}),
                    arch: row.arch,
                    status: t(`custom_apps:release_statuses.${row.status}`, {defaultValue: row.status}),
                  })}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <FieldLegend label={t("custom_apps:maintenances.fields.installations")} help={help.field("maintenances.help.installations", {max: MAINTENANCE_TEXT_LIMITS.maxInstallations})}>
              {form.scope === "pick" && form.installationIds.length > 0 && (
                <span className="text-[12px] font-normal text-neutral-500">
                  {t("custom_apps:maintenances.installations_count", {count: form.installationIds.length})}
                </span>
              )}
            </FieldLegend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
              {(["all", "pick"] as const).map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="radio"
                    name="maintenance-scope"
                    value={value}
                    checked={form.scope === value}
                    disabled={pending}
                    onChange={() => set("scope", value)}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  {t(`custom_apps:maintenances.installations_${value}`)}
                </label>
              ))}
            </div>
            {form.scope === "all" ? (
              <p className="text-[12px] leading-relaxed text-neutral-500">{t("custom_apps:maintenances.hints.installations_all")}</p>
            ) : (
              <>
                {candidates.length > 8 && (
                  <SearchBox value={search} onChange={setSearch} placeholder={t("custom_apps:maintenances.installations_search")} />
                )}
                <div className="max-h-60 overflow-y-auto rounded-[var(--radius-md)] border border-neutral-800">
                  {installations.loading && !installations.data ? (
                    <p className="px-3 py-3 text-[13px] text-neutral-500">{t("admin:common.loading")}</p>
                  ) : visible.length === 0 ? (
                    <p className="px-3 py-3 text-[13px] text-neutral-500">
                      {candidates.length === 0 ? t("custom_apps:maintenances.installations_empty") : t("custom_apps:no_matches", {search})}
                    </p>
                  ) : (
                    <ul>
                      {visible.map((row) => {
                        const id = `maintenance-installation-${row.id}`;
                        const off = release ? !onLine(release, row) : false;
                        return (
                          <li key={row.id} className="border-b border-neutral-800/70 last:border-0">
                            <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-neutral-800/30">
                              <input
                                id={id}
                                type="checkbox"
                                checked={form.installationIds.includes(row.id)}
                                disabled={pending}
                                onChange={(event) => toggle(row.id, event.target.checked)}
                                className="size-4 shrink-0 accent-[var(--color-accent)]"
                              />
                              <span className="min-w-0 flex-1 truncate text-sm text-text">{installationLabel(row)}</span>
                              {off && (
                                <span className="shrink-0 text-[11px] text-amber-300">{t("custom_apps:maintenances.off_line")}</span>
                              )}
                              <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                                {[t(`custom_apps:channels.${row.channel}`, {defaultValue: row.channel}), row.app_version && `v${row.app_version}`, row.arch]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
            {errors.installations && <p className="text-xs text-red-400">{errors.installations}</p>}
          </fieldset>
        </FormSection>

        {form.kind === "security" && (
          <Alert tone="info" title={t("custom_apps:maintenance_kinds.security")}>
            {t("custom_apps:maintenances.security_notice", {lead: Math.round(maintenanceLimits.security_min_lead_minutes / 60)})}
          </Alert>
        )}

        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {describeFailure(save.status, save.error)}
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
            {maintenance ? t("admin:common.save") : t("custom_apps:maintenances.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
