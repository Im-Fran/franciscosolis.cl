import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, ListChecks} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {useReportColumns} from "@/pages/custom-apps/components/releases/report-columns.tsx";

const PAGE_SIZE = 25;

/**
 * Every report devices sent about one release, newest first.
 *
 * `version` is bumped by the release page whenever it reloads the release, so the reports and the
 * figures above them never disagree for longer than one request.
 */
export const ReleaseReports = ({releaseId, version}: {releaseId: string; version: number}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [offset, setOffset] = useState(0);
  const reports = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.releases.reports(releaseId, {limit: PAGE_SIZE, offset}, signal),
      [releaseId, offset],
    ),
  );
  const {reload} = reports;
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);
  const columns = useReportColumns({withDevice: true, withVersion: false});
  const rows = reports.data?.data ?? [];

  return (
    <Panel
      title={t("custom_apps:update_reports.title")}
      description={
        reports.data
          ? t("custom_apps:update_reports.count", {count: reports.data.pagination.total})
          : t("custom_apps:update_reports.description")
      }
      action={
        <Button variant="ghost" size="sm" onClick={reports.reload} disabled={reports.loading}>
          <ArrowClockwise size={14} className={reports.loading ? "animate-spin" : undefined} />
          {t("admin:common.refresh")}
        </Button>
      }
    >
      <PanelState loading={reports.loading && !reports.data} error={reports.data ? null : reports.error} onRetry={reports.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={28} />}
            title={t("custom_apps:update_reports.empty")}
            description={t("custom_apps:update_reports.empty_description")}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.id)}
            caption={t("custom_apps:update_reports.title")}
            className={reports.loading ? "opacity-60 transition-opacity" : undefined}
          />
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={reports.data?.pagination.total}
          onChange={setOffset}
          disabled={reports.loading}
        />
      </PanelState>
    </Panel>
  );
};
