import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Field, Select} from "@/components/ui/input.tsx";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {InstallationSummary, TargetScope} from "@/lib/custom-apps/types.ts";
import {InstallationSelect} from "@/pages/custom-apps/components/installation-select.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

/**
 * Who a flag or a message is for: the whole app, one release channel, or one device. The second
 * field follows the first — a channel picker, a device picker, or nothing — and is required whenever
 * it is shown.
 */
export const ScopeFields = ({
  idPrefix,
  scope,
  scopeValue,
  onScope,
  onScopeValue,
  installations,
  installationsLoading,
  disabled,
  error,
}: {
  idPrefix: string;
  scope: TargetScope;
  scopeValue: string;
  onScope: (scope: TargetScope) => void;
  onScopeValue: (value: string) => void;
  installations: InstallationSummary[];
  installationsLoading?: boolean;
  disabled?: boolean;
  error?: string;
}) => {
  const {t} = useTranslation("custom_apps");
  const {targetScopes, channels} = useServiceVocabulary();
  const help = useHelp();

  return (
    <>
      <Field
        label={t("scope.label")}
        htmlFor={`${idPrefix}-scope`}
        hint={t(`scope.hint.${scope}`, {defaultValue: ""})}
        help={help.field("scope.help.scope")}
      >
        <Select
          id={`${idPrefix}-scope`}
          value={scope}
          disabled={disabled}
          onChange={(event) => {
            onScope(event.target.value as TargetScope);
            onScopeValue("");
          }}
        >
          {targetScopes.map((option) => (
            <option key={option} value={option}>
              {t(`scope.${option}`, {defaultValue: option})}
            </option>
          ))}
        </Select>
      </Field>

      {scope === "channel" && (
        <Field
          label={t("scope.channel_value")}
          htmlFor={`${idPrefix}-scope-value`}
          error={error}
          help={help.field("scope.help.channel")}
          required
        >
          <Select
            id={`${idPrefix}-scope-value`}
            value={scopeValue}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(event) => onScopeValue(event.target.value)}
          >
            <option value="">{t("scope.pick_channel")}</option>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {t(`channels.${channel}`, {defaultValue: channel})}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {scope === "installation" && (
        <Field
          label={t("scope.installation_value")}
          htmlFor={`${idPrefix}-scope-value`}
          error={error}
          help={help.field("scope.help.installation")}
          required
        >
          <InstallationSelect
            id={`${idPrefix}-scope-value`}
            value={scopeValue}
            onChange={onScopeValue}
            installations={installations}
            loading={installationsLoading}
            disabled={disabled}
            invalid={Boolean(error)}
            emptyLabel={t("scope.pick_installation")}
          />
        </Field>
      )}
    </>
  );
};

/** "Whole app", "Channel · Beta", or the device's name as a link to it. */
export const ScopeLabel = ({
  scope,
  value,
  names,
}: {
  scope: TargetScope | string;
  value: string | null;
  names: Map<string, string>;
}) => {
  const {t} = useTranslation("custom_apps");

  if (scope === "channel" && value) {
    return (
      <span>
        {t("scope.channel_short", {channel: t(`channels.${value}`, {defaultValue: value})})}
      </span>
    );
  }

  if (scope === "installation" && value) {
    return (
      <span>
        {t("scope.installation_short")}{" "}
        <Link to={customAppsRoute.installation(value)} className="text-text hover:underline">
          {names.get(value) ?? value}
        </Link>
      </span>
    );
  }

  return <span>{t("scope.app_short")}</span>;
};
