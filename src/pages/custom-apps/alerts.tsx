import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useSearchParams} from "react-router-dom";
import {ArrowClockwise, BellSimpleSlash, X} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {formatAlertValue} from "@/lib/custom-apps/alerts.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {AlertEntry, AlertQueryStatus} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {AlertKindIcon} from "@/pages/custom-apps/components/alerts/alert-kind.tsx";
import {AlertsTabs} from "@/pages/custom-apps/components/alerts/alerts-tabs.tsx";
import {AppSelect} from "@/pages/custom-apps/components/alerts/app-select.tsx";
import {AlertStatusBadge} from "@/pages/custom-apps/components/badges.tsx";

const PAGE_SIZE = 50;
const REFRESH_MS = 30_000;
const DEFAULT_STATUS: AlertQueryStatus = "unresolved";

/**
 * Every alert the service raised, newest activity first, opening on the unresolved ones — open or
 * acknowledged, the two that still need somebody.
 *
 * The filters live in the address, so "the open alerts of that app" is a link: the app summary and
 * an installation's page both point here filtered to themselves. It refreshes every thirty seconds
 * like the overview, because an inbox that was right when it loaded is not one.
 */
export const Alerts = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const {alertStatuses} = useServiceVocabulary();
  const [params, setParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const language = i18n.language;

  const status = (params.get("status") as AlertQueryStatus | "all" | null) ?? DEFAULT_STATUS;
  const appId = params.get("app_id") ?? "";
  const ruleId = params.get("rule_id") ?? "";
  const installationId = params.get("installation_id") ?? "";

  const setFilter = (key: string, value: string) => {
    setOffset(0);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      {replace: true},
    );
  };

  const alerts = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.alerts.list(
          {
            status: status === "all" ? undefined : status,
            app_id: appId || undefined,
            rule_id: ruleId || undefined,
            installation_id: installationId || undefined,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [status, appId, ruleId, installationId, offset],
    ),
  );
  useAutoRefresh(alerts.reload, REFRESH_MS);

  const rows = alerts.data?.data ?? [];
  const filtered = status !== DEFAULT_STATUS || Boolean(appId || ruleId || installationId);

  const columns = useMemo<Column<AlertEntry>[]>(
    () => [
      {
        key: "kind",
        header: t("custom_apps:alerts.columns.alert"),
        cell: (row) => (
          <div className="flex min-w-0 items-start gap-3">
            <AlertKindIcon kind={row.kind} size={18} className="mt-0.5 shrink-0 text-neutral-500" />
            <div className="min-w-0">
              <p className="truncate text-sm text-text">{t(`custom_apps:alert_kinds.${row.kind}`, {defaultValue: row.kind})}</p>
              <p className="truncate text-[12px] text-neutral-500">
                {[row.subject_name, row.app_name !== row.subject_name ? row.app_name : null, row.rule_name]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "value",
        header: t("custom_apps:alerts.columns.value"),
        className: "w-40",
        cell: (row) => (
          <span className="flex flex-col tabular-nums">
            <span className="text-text">{formatAlertValue(row.kind, row.value, language) ?? "—"}</span>
            <span className="text-[12px] text-neutral-500">
              {t("custom_apps:alerts.threshold_short", {threshold: formatAlertValue(row.kind, row.threshold, language) ?? "—"})}
            </span>
          </span>
        ),
      },
      {
        key: "status",
        header: t("custom_apps:alerts.columns.status"),
        className: "w-32",
        cell: (row) => <AlertStatusBadge value={row.status} />,
      },
      {
        key: "occurrences",
        header: t("custom_apps:alerts.columns.occurrences"),
        className: "w-24 text-right tabular-nums",
        hideBelowLg: true,
        cell: (row) => row.occurrences,
      },
      {
        key: "last",
        header: t("custom_apps:alerts.columns.last_triggered"),
        className: "w-36",
        cell: (row) => (
          <time dateTime={row.last_triggered_at} title={formatDateTime(row.last_triggered_at, language) ?? undefined}>
            {formatLastSeen(row.last_triggered_at, language)}
          </time>
        ),
      },
    ],
    [language, t],
  );

  return (
    <>
      <PageHeader
        title={t("custom_apps:alerts.title")}
        description={t("custom_apps:alerts.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={alerts.reload} disabled={alerts.loading}>
            <ArrowClockwise size={14} className={alerts.loading ? "animate-spin" : undefined} />
            {t("admin:common.refresh")}
          </Button>
        }
      />
      <AlertsTabs />

      <Panel
        title={t("custom_apps:alerts.inbox_title")}
        description={alerts.data ? t("custom_apps:alerts.count", {count: alerts.data.pagination.total}) : undefined}
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Select
            value={status}
            onChange={(event) => setFilter("status", event.target.value === DEFAULT_STATUS ? "" : event.target.value)}
            aria-label={t("custom_apps:alerts.filters.status")}
            className="w-auto min-w-[12rem]"
          >
            <option value="unresolved">{t("custom_apps:alerts.filters.unresolved")}</option>
            {alertStatuses.map((value) => (
              <option key={value} value={value}>
                {t(`custom_apps:alert_statuses.${value}`, {defaultValue: value})}
              </option>
            ))}
            <option value="all">{t("custom_apps:alerts.filters.all")}</option>
          </Select>
          <AppSelect
            value={appId}
            onChange={(value) => setFilter("app_id", value)}
            emptyLabel={t("custom_apps:alerts.filters.any_app")}
            className="w-auto min-w-[14rem]"
          />
          {ruleId && (
            <Button variant="secondary" size="sm" onClick={() => setFilter("rule_id", "")}>
              {rows[0]?.rule_name
                ? t("custom_apps:alerts.filters.one_rule_named", {name: rows[0].rule_name})
                : t("custom_apps:alerts.filters.one_rule")}
              <X size={12} aria-label={t("admin:common.clear_filters")} />
            </Button>
          )}
          {installationId && (
            <Button variant="secondary" size="sm" onClick={() => setFilter("installation_id", "")}>
              {t("custom_apps:alerts.filters.one_installation")}
              <X size={12} aria-label={t("admin:common.clear_filters")} />
            </Button>
          )}
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOffset(0);
                setParams(new URLSearchParams(), {replace: true});
              }}
            >
              {t("admin:common.clear_filters")}
            </Button>
          )}
        </div>

        <PanelState
          loading={alerts.loading && !alerts.data}
          error={alerts.data ? null : alerts.error}
          forbidden={alerts.status === 403}
          onRetry={alerts.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={<BellSimpleSlash size={28} />}
              title={status === DEFAULT_STATUS && !filtered ? t("custom_apps:alerts.empty") : t("custom_apps:alerts.no_matches")}
              description={status === DEFAULT_STATUS && !filtered ? t("custom_apps:alerts.empty_description") : undefined}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(customAppsRoute.alert(row.id))}
              caption={t("custom_apps:alerts.inbox_title")}
            />
          )}
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={alerts.data?.pagination.total}
            onChange={setOffset}
            disabled={alerts.loading}
          />
        </PanelState>
      </Panel>
    </>
  );
};
