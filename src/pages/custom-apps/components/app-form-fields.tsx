import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {cn} from "@/lib/utils.ts";
import type {AppKind, AppModule, LogLevel, PresenceMode} from "@/lib/custom-apps/types.ts";
import {APP_NAME_MAX} from "@/pages/custom-apps/components/app-form.ts";
import type {AppForm, AppFormErrors, AppFormField} from "@/pages/custom-apps/components/app-form.ts";
import {CheckboxGroup} from "@/pages/custom-apps/components/checkbox-group.tsx";
import {OperatingHoursField} from "@/pages/custom-apps/components/operating-hours-field.tsx";

/**
 * The companies an app can belong to, alphabetically. The CRM is small; one page holds it. Also the
 * app list's company filter, where the empty option means "every company" rather than "pick one".
 */
export const CompanySelect = ({
  id = "app-company",
  value,
  onChange,
  disabled,
  invalid,
  emptyLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  emptyLabel?: string;
}) => {
  const {t} = useTranslation("custom_apps");
  const companies = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.companies.list({limit: 200}, signal), []),
  );
  const rows = [...(companies.data?.data ?? [])].sort((a, b) =>
    (a.trade_name || a.legal_name).localeCompare(b.trade_name || b.legal_name),
  );

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled || companies.loading}
      aria-invalid={invalid}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{companies.loading ? t("admin:common.loading") : (emptyLabel ?? t("apps.pick_company"))}</option>
      {rows.map((company) => (
        <option key={company.id} value={company.id}>
          {company.trade_name ? `${company.trade_name} (${company.legal_name})` : company.legal_name}
        </option>
      ))}
    </Select>
  );
};

/**
 * The fields an app is made of, shared by the create screen and the Settings tab so the two cannot
 * drift apart. The presence mode, the log level and the screenshot switch are only offered once the
 * app exists: each has a sensible default, and each is a decision about a running app rather than
 * about registering one.
 */
export const AppFormFields = ({
  form,
  set,
  errors,
  disabled,
  mode,
}: {
  form: AppForm;
  set: <K extends AppFormField>(key: K, value: AppForm[K]) => void;
  errors: AppFormErrors;
  disabled?: boolean;
  mode: "create" | "edit";
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const vocabulary = useServiceVocabulary();

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t("custom_apps:apps.fields.company")} htmlFor="app-company" error={errors.companyId}>
        <CompanySelect
          value={form.companyId}
          onChange={(value) => set("companyId", value)}
          disabled={disabled}
          invalid={Boolean(errors.companyId)}
        />
      </Field>

      <Field label={t("custom_apps:apps.fields.name")} htmlFor="app-name" error={errors.name}>
        <Input
          id="app-name"
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
          maxLength={APP_NAME_MAX}
          aria-invalid={Boolean(errors.name)}
          disabled={disabled}
          autoComplete="off"
          required
        />
      </Field>

      <Field label={t("custom_apps:apps.fields.kind")} htmlFor="app-kind" hint={t(`custom_apps:kinds_hint.${form.kind}`, {defaultValue: ""})}>
        <Select
          id="app-kind"
          value={form.kind}
          disabled={disabled}
          onChange={(event) => set("kind", event.target.value as AppKind)}
        >
          {vocabulary.kinds.map((kind) => (
            <option key={kind} value={kind}>
              {t(`custom_apps:kinds.${kind}`, {defaultValue: kind})}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={t("custom_apps:apps.fields.domain")}
        htmlFor="app-domain"
        error={errors.domain}
        hint={t("custom_apps:apps.hints.domain")}
      >
        <Input
          id="app-domain"
          value={form.domain}
          onChange={(event) => set("domain", event.target.value)}
          placeholder="app.cliente.cl"
          aria-invalid={Boolean(errors.domain)}
          disabled={disabled}
          autoComplete="off"
          className="font-mono text-[13px]"
        />
      </Field>

      <Field label={t("custom_apps:apps.fields.description")} htmlFor="app-description" className="sm:col-span-2">
        <Textarea
          id="app-description"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          rows={3}
          disabled={disabled}
          className="resize-y"
        />
      </Field>

      <Field
        label={t("custom_apps:apps.fields.repository")}
        htmlFor="app-repository"
        error={errors.repositoryUrl}
        className="sm:col-span-2"
      >
        <Input
          id="app-repository"
          type="url"
          value={form.repositoryUrl}
          onChange={(event) => set("repositoryUrl", event.target.value)}
          placeholder="https://github.com/…"
          aria-invalid={Boolean(errors.repositoryUrl)}
          disabled={disabled}
          autoComplete="off"
          className="font-mono text-[13px]"
        />
      </Field>

      {mode === "edit" && (
        <Field
          label={t("custom_apps:apps.fields.presence")}
          htmlFor="app-presence"
          hint={
            form.kind === "web" && form.presenceMode === "socket"
              ? t("custom_apps:apps.hints.presence_web")
              : t("custom_apps:apps.hints.presence")
          }
        >
          <Select
            id="app-presence"
            value={form.presenceMode}
            disabled={disabled}
            onChange={(event) => set("presenceMode", event.target.value as PresenceMode)}
          >
            {vocabulary.presenceModes.map((presence) => (
              <option key={presence} value={presence}>
                {t(`custom_apps:presence.${presence}`, {defaultValue: presence})}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label={t("custom_apps:apps.fields.heartbeat")}
        htmlFor="app-heartbeat"
        error={errors.heartbeat}
        hint={t("custom_apps:apps.hints.heartbeat", {
          min: vocabulary.heartbeat.min,
          max: vocabulary.heartbeat.max,
          intervals: vocabulary.offlineAfter,
        })}
      >
        <Input
          id="app-heartbeat"
          type="number"
          inputMode="numeric"
          min={vocabulary.heartbeat.min}
          max={vocabulary.heartbeat.max}
          value={form.heartbeat}
          onChange={(event) => set("heartbeat", event.target.value)}
          aria-invalid={Boolean(errors.heartbeat)}
          disabled={disabled}
          className="font-mono"
        />
      </Field>

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-neutral-300">{t("custom_apps:apps.fields.modules")}</legend>
        <CheckboxGroup
          idPrefix="app-module"
          options={vocabulary.modules.map((module) => ({
            value: module,
            label: t(`custom_apps:modules.${module}`, {defaultValue: module}),
            hint: t(`custom_apps:modules_hint.${module}`, {defaultValue: ""}) || undefined,
          }))}
          value={form.modules}
          onChange={(value) => set("modules", value as AppModule[])}
          disabled={disabled}
        />
        <p className="text-xs text-neutral-500">{t("custom_apps:apps.hints.modules")}</p>
      </fieldset>

      {mode === "edit" && (
        <>
          <Field
            label={t("custom_apps:apps.fields.log_level")}
            htmlFor="app-log-level"
            hint={t("custom_apps:apps.hints.log_level")}
          >
            <Select
              id="app-log-level"
              value={form.logLevel}
              disabled={disabled}
              onChange={(event) => set("logLevel", event.target.value as LogLevel)}
            >
              {vocabulary.logLevels.map((level) => (
                <option key={level} value={level}>
                  {t(`custom_apps:log_levels.${level}`, {defaultValue: level})}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-300">{t("custom_apps:apps.fields.screenshots_title")}</span>
            <label
              htmlFor="app-screenshots"
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
                form.screenshots ? "border-amber-500/50 bg-amber-500/5" : "border-neutral-800 hover:border-neutral-700",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                id="app-screenshots"
                type="checkbox"
                checked={form.screenshots}
                disabled={disabled}
                onChange={(event) => set("screenshots", event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm text-text">{t("custom_apps:apps.fields.screenshots")}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                  {t("custom_apps:apps.hints.screenshots")}
                </span>
              </span>
            </label>
          </div>
        </>
      )}

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-neutral-300">{t("custom_apps:apps.fields.hours")}</legend>
        <OperatingHoursField
          value={form.hours}
          onChange={(value) => set("hours", value)}
          disabled={disabled}
          defaultTimezone={vocabulary.timezone}
        />
        {errors.hours && <p className="text-xs text-red-400">{errors.hours}</p>}
      </fieldset>
    </div>
  );
};
