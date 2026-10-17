import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {formatDateTime} from "@/lib/auth/format.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {ReleaseReport} from "@/lib/custom-apps/types.ts";
import type {Column} from "@/components/admin/data-table.tsx";
import {UpdateReportStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

/**
 * The columns both report lists share: a release's (one row per device step) and an installation's
 * (one row per step, across releases). `withDevice` and `withVersion` pick which side of the join
 * is worth a column.
 */
export const useReportColumns = ({withDevice, withVersion}: {withDevice: boolean; withVersion: boolean}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;

  return useMemo<Column<ReleaseReport>[]>(() => {
    const columns: Column<ReleaseReport>[] = [];
    if (withDevice) {
      columns.push({
        key: "device",
        header: t("update_reports.columns.device"),
        cell: (row) => (
          <Link to={customAppsRoute.installation(row.installation_id)} className="text-text hover:underline">
            {installationLabel({alias: row.installation_alias, hostname: row.installation_hostname, device_id: row.installation_id})}
          </Link>
        ),
      });
    }
    if (withVersion) {
      columns.push({
        key: "version",
        header: t("update_reports.columns.version"),
        className: "w-28",
        cell: (row) => <span className="font-mono text-[13px]">{row.version ?? "—"}</span>,
      });
    }
    columns.push(
      {
        key: "status",
        header: t("update_reports.columns.status"),
        className: "w-36",
        cell: (row) => <UpdateReportStatusBadge value={row.status} />,
      },
      {
        key: "from",
        header: t("update_reports.columns.from"),
        className: "w-28",
        hideBelowLg: true,
        cell: (row) => <span className="font-mono text-[13px]">{row.from_version ?? "—"}</span>,
      },
      {
        key: "detail",
        header: t("update_reports.columns.detail"),
        cell: (row) =>
          row.detail ? (
            <span className="block max-w-md font-mono text-[12px] break-words whitespace-pre-wrap text-neutral-400">{row.detail}</span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
      },
      {
        key: "when",
        header: t("update_reports.columns.when"),
        className: "w-36",
        cell: (row) => (
          <time dateTime={row.created_at} title={formatDateTime(row.created_at, language) ?? undefined}>
            {formatLastSeen(row.created_at, language)}
          </time>
        ),
      },
    );
    return columns;
  }, [language, t, withDevice, withVersion]);
};
