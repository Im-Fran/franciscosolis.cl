import {useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatBytes, formatDuration, formatNumber, formatPercent} from "@/lib/custom-apps/format.ts";
import type {DailyStat} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";

/** "avg / p95 / max" in one cell, which is how a day's load is read: typical, bad, worst. */
const spread = (values: (number | null)[], language: string) =>
  values.every((value) => value === null)
    ? "—"
    : values.map((value) => formatNumber(value, language) ?? "—").join(" / ");

/**
 * One row per day for the last thirty — the table behind the charts, and the place to read exact
 * figures. Today is included and computed live by the service, so its row moves while you watch.
 */
export const InstallationDaily = ({installationId}: {installationId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;

  const daily = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.installations.daily(installationId, {}, signal), [installationId]),
  );

  /* Newest first: yesterday is what somebody opens this table to check. */
  const rows = useMemo(() => [...(daily.data ?? [])].sort((a, b) => b.day.localeCompare(a.day)), [daily.data]);
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(language, {weekday: "short", day: "numeric", month: "short", timeZone: "UTC"}),
    [language],
  );

  const columns = useMemo<Column<DailyStat>[]>(
    () => [
      {
        key: "day",
        header: t("custom_apps:daily.day"),
        className: "w-32 whitespace-nowrap",
        cell: (row) => dayFormat.format(new Date(`${row.day}T12:00:00Z`)),
      },
      {key: "active", header: t("custom_apps:daily.active"), className: "w-24", cell: (row) => formatDuration(row.active_seconds)},
      {key: "online", header: t("custom_apps:daily.online"), className: "w-24", cell: (row) => formatDuration(row.online_seconds)},
      {
        key: "cpu",
        header: t("custom_apps:daily.cpu"),
        className: "w-32 tabular-nums",
        cell: (row) => spread([row.cpu_avg, row.cpu_p95, row.cpu_max], language),
      },
      {
        key: "memory",
        header: t("custom_apps:daily.memory"),
        className: "w-32 tabular-nums",
        cell: (row) => spread([row.memory_avg, row.memory_p95, row.memory_max], language),
      },
      {
        key: "network",
        header: t("custom_apps:daily.network"),
        className: "w-40 tabular-nums",
        hideBelowLg: true,
        cell: (row) => `↓ ${formatBytes(row.net_rx_bytes, language)} · ↑ ${formatBytes(row.net_tx_bytes, language)}`,
      },
      {
        key: "battery",
        header: t("custom_apps:daily.battery"),
        className: "w-24 tabular-nums",
        hideBelowLg: true,
        cell: (row) => formatPercent(row.battery_min, language) ?? "—",
      },
      {
        key: "events",
        header: t("custom_apps:daily.events"),
        className: "w-20 tabular-nums",
        hideBelowLg: true,
        cell: (row) => row.events,
      },
    ],
    [dayFormat, language, t],
  );

  return (
    <Panel title={t("custom_apps:daily.title")} description={t("custom_apps:daily.description")}>
      <PanelState
        loading={daily.loading}
        error={daily.error}
        empty={rows.length === 0}
        emptyLabel={t("custom_apps:daily.empty")}
        onRetry={daily.reload}
        ns="admin"
      >
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.day} caption={t("custom_apps:daily.title")} />
      </PanelState>
    </Panel>
  );
};
