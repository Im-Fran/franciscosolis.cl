import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {ArrowClockwise, Bug} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatLastSeen, formatNumber} from "@/lib/custom-apps/format.ts";
import type {CrashGroup, CrashStatus} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {CrashStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";

const PAGE_SIZE = 25;

/**
 * The app's crashes, grouped: one row per signature and version, with how often it happened and on
 * how many devices. Opens on the open ones — a resolved crash is history, and an ignored one was a
 * decision — and a resolved crash that happens again opens itself.
 */
export const CrashGroupsPanel = ({appId}: {appId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const {crashStatuses} = useServiceVocabulary();
  const [status, setStatus] = useState<"" | CrashStatus>("open");
  const [version, setVersion] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [filters] = useDebounceValue({search: search.trim(), app_version: version.trim()}, 300, {
    equalityFn: (a, b) => a.search === b.search && a.app_version === b.app_version,
  });

  const crashes = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.crashes.list(
          appId,
          {
            status: status || undefined,
            search: filters.search || undefined,
            app_version: filters.app_version || undefined,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [appId, status, filters, offset],
    ),
  );

  const rows = crashes.data?.data ?? [];
  const filtered = Boolean(filters.search || filters.app_version || status !== "open");
  const language = i18n.language;

  const filter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  const columns = useMemo<Column<CrashGroup>[]>(
    () => [
      {
        key: "title",
        header: t("custom_apps:crashes.columns.crash"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text" title={row.title}>
              {row.title}
            </p>
            <p className="truncate font-mono text-[11px] text-neutral-600" title={row.signature}>
              {row.signature}
            </p>
          </div>
        ),
      },
      {
        key: "version",
        header: t("custom_apps:crashes.columns.version"),
        className: "w-28",
        cell: (row) => <span className="font-mono text-[13px]">{row.app_version ?? "—"}</span>,
      },
      {
        key: "status",
        header: t("custom_apps:crashes.columns.status"),
        className: "w-28",
        cell: (row) => <CrashStatusBadge value={row.status} />,
      },
      {
        key: "occurrences",
        header: t("custom_apps:crashes.columns.occurrences"),
        className: "w-28 text-right",
        cell: (row) => (
          <span className="tabular-nums" title={t("custom_apps:crashes.affected", {count: row.affected_installations})}>
            {formatNumber(row.occurrences, language)}
            <span className="block text-[12px] text-neutral-500">
              {t("custom_apps:crashes.devices", {count: row.affected_installations})}
            </span>
          </span>
        ),
      },
      {
        key: "last_seen",
        header: t("custom_apps:crashes.columns.last_seen"),
        className: "w-36",
        hideBelowLg: true,
        cell: (row) => (
          <time dateTime={row.last_seen_at} title={formatDateTime(row.last_seen_at, language) ?? undefined}>
            {formatLastSeen(row.last_seen_at, language)}
          </time>
        ),
      },
    ],
    [language, t],
  );

  return (
    <Panel
      title={t("custom_apps:crashes.title")}
      description={
        crashes.data
          ? t("custom_apps:crashes.count", {count: crashes.data.pagination.total})
          : t("custom_apps:crashes.description")
      }
      action={
        <Button variant="ghost" size="sm" onClick={crashes.reload} disabled={crashes.loading}>
          <ArrowClockwise size={14} className={crashes.loading ? "animate-spin" : undefined} />
          {t("admin:common.refresh")}
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(value) => filter(() => setSearch(value))} placeholder={t("custom_apps:crashes.search")} />
        <Input
          value={version}
          onChange={(event) => filter(() => setVersion(event.target.value))}
          placeholder={t("custom_apps:crashes.version_filter")}
          aria-label={t("custom_apps:crashes.version_filter")}
          className="w-auto max-w-[10rem] font-mono text-[13px]"
        />
        <Select
          value={status}
          onChange={(event) => filter(() => setStatus(event.target.value as "" | CrashStatus))}
          aria-label={t("custom_apps:crashes.status_filter")}
          className="w-auto min-w-[10rem]"
        >
          <option value="">{t("custom_apps:crashes.any_status")}</option>
          {crashStatuses.map((value) => (
            <option key={value} value={value}>
              {t(`custom_apps:crash_statuses.${value}`, {defaultValue: value})}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              filter(() => {
                setSearch("");
                setVersion("");
                setStatus("open");
              })
            }
          >
            {t("admin:common.clear_filters")}
          </Button>
        )}
      </div>

      <PanelState
        loading={crashes.loading && !crashes.data}
        error={crashes.data ? null : crashes.error}
        onRetry={crashes.reload}
        ns="admin"
      >
        {rows.length === 0 ? (
          filtered ? (
            <p className="py-4 text-sm text-neutral-500">{t("custom_apps:crashes.no_matches")}</p>
          ) : (
            <EmptyState icon={<Bug size={28} />} title={t("custom_apps:crashes.empty")} description={t("custom_apps:crashes.empty_description")} />
          )
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(customAppsRoute.crash(row.id))}
            caption={t("custom_apps:crashes.title")}
            className={crashes.loading ? "opacity-60 transition-opacity" : undefined}
          />
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={crashes.data?.pagination.total}
          onChange={setOffset}
          disabled={crashes.loading}
        />
      </PanelState>
    </Panel>
  );
};
