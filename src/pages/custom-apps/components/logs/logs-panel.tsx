import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {useDebounceValue} from "usehooks-ts";
import {ArrowClockwise, Scroll} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {dayBound} from "@/lib/custom-apps/format.ts";
import type {InstallationSummary, LogLevel} from "@/lib/custom-apps/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {InstallationSelect} from "@/pages/custom-apps/components/installation-select.tsx";
import {LogItem} from "@/pages/custom-apps/components/logs/log-item.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const PAGE_SIZE = 50;

export type LogsScope = {kind: "app"; appId: string; installations: InstallationSummary[]} | {kind: "installation"; installationId: string};

/**
 * Log entries, newest first, filtered on the service: a minimum level ("warning" shows warnings,
 * errors and fatals), a text search, a date range and — across a fleet — one device.
 *
 * It does not poll. Logs are read to find something, and a list that shifts under the reader every
 * few seconds would move the line they were reading; the refresh button is there for "anything new?".
 */
export const LogsPanel = ({scope, description}: {scope: LogsScope; description?: string}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {logLevels} = useServiceVocabulary();
  const [level, setLevel] = useState<"" | LogLevel>("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [offset, setOffset] = useState(0);
  const [debounced] = useDebounceValue(search.trim(), 300);

  const scopeKey = scope.kind === "app" ? `app:${scope.appId}` : `installation:${scope.installationId}`;
  const scopeId = scope.kind === "app" ? scope.appId : scope.installationId;

  const logs = useResource(
    useCallback(
      (signal: AbortSignal) => {
        const params = {
          level: level || undefined,
          search: debounced || undefined,
          from: dayBound(from, false),
          to: dayBound(to, true),
          limit: PAGE_SIZE,
          offset,
        };
        return scopeKey.startsWith("app:")
          ? customAppsApi.apps.logs(scopeId, {...params, installation_id: installationId || undefined}, signal)
          : customAppsApi.installations.logs(scopeId, params, signal);
      },
      [scopeKey, scopeId, level, debounced, from, to, installationId, offset],
    ),
  );

  const rows = logs.data?.data ?? [];
  const filtered = Boolean(level || debounced || from || to || installationId);

  const filter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  return (
    <Panel
      title={t("custom_apps:logs.title")}
      description={description ?? t("custom_apps:logs.description")}
      action={
        <Button variant="ghost" size="sm" onClick={logs.reload} disabled={logs.loading}>
          <ArrowClockwise size={14} className={logs.loading ? "animate-spin" : undefined} />
          {t("admin:common.refresh")}
        </Button>
      }
    >
      <div className={`mb-5 grid gap-3 sm:grid-cols-2 ${scope.kind === "app" ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <Field label={t("custom_apps:logs.filters.level")} htmlFor={`${scopeKey}-level`} help={help.field("logs.filter_help.level")}>
          <Select
            id={`${scopeKey}-level`}
            value={level}
            onChange={(event) => filter(() => setLevel(event.target.value as "" | LogLevel))}
          >
            <option value="">{t("custom_apps:logs.filters.any_level")}</option>
            {logLevels.map((option) => (
              <option key={option} value={option}>
                {t("custom_apps:logs.filters.at_least", {level: t(`custom_apps:log_levels.${option}`, {defaultValue: option})})}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("custom_apps:logs.filters.search")} htmlFor={`${scopeKey}-search`} help={help.field("logs.filter_help.search")}>
          <Input
            id={`${scopeKey}-search`}
            type="search"
            value={search}
            onChange={(event) => filter(() => setSearch(event.target.value))}
            placeholder={t("custom_apps:logs.filters.search_placeholder")}
          />
        </Field>
        {scope.kind === "app" && (
          <Field label={t("custom_apps:logs.filters.installation")} htmlFor={`${scopeKey}-installation`} help={help.field("logs.filter_help.installation")}>
            <InstallationSelect
              id={`${scopeKey}-installation`}
              value={installationId}
              onChange={(value) => filter(() => setInstallationId(value))}
              installations={scope.installations}
              emptyLabel={t("custom_apps:usage.all_installations")}
              includeRevoked
            />
          </Field>
        )}
        <Field label={t("custom_apps:audit.filters.from")} htmlFor={`${scopeKey}-from`} help={help.field("logs.filter_help.from")}>
          <Input
            id={`${scopeKey}-from`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => filter(() => setFrom(event.target.value))}
          />
        </Field>
        <Field label={t("custom_apps:audit.filters.to")} htmlFor={`${scopeKey}-to`} help={help.field("logs.filter_help.to")}>
          <Input
            id={`${scopeKey}-to`}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => filter(() => setTo(event.target.value))}
          />
        </Field>
      </div>
      {filtered && (
        <div className="-mt-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              filter(() => {
                setLevel("");
                setSearch("");
                setFrom("");
                setTo("");
                setInstallationId("");
              })
            }
          >
            {t("admin:common.clear_filters")}
          </Button>
        </div>
      )}

      <PanelState loading={logs.loading && !logs.data} error={logs.error} onRetry={logs.reload} ns="admin">
        {rows.length === 0 ? (
          filtered ? (
            <p className="py-4 text-sm text-neutral-500">{t("custom_apps:logs.no_matches")}</p>
          ) : (
            <EmptyState
              icon={<Scroll size={28} />}
              title={t("custom_apps:logs.empty")}
              description={t("custom_apps:logs.empty_description")}
            />
          )
        ) : (
          <ul className={logs.loading ? "opacity-60 transition-opacity" : undefined}>
            {rows.map((entry) => (
              <LogItem key={entry.id} entry={entry} showInstallation={scope.kind === "app"} />
            ))}
          </ul>
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={logs.data?.pagination.total}
          onChange={setOffset}
          disabled={logs.loading}
        />
      </PanelState>
    </Panel>
  );
};
