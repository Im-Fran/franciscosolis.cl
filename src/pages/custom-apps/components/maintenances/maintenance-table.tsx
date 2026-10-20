import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {CheckCircle, EnvelopeSimple, XCircle} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatMinutes} from "@/lib/custom-apps/format.ts";
import type {Maintenance} from "@/lib/custom-apps/types.ts";
import {formatZonedWindow} from "@/lib/custom-apps/zoned-time.ts";
import {MaintenanceKindBadge, MaintenanceStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {leadingWindow} from "@/pages/custom-apps/components/maintenances/maintenance-format.ts";

/**
 * The rows of a maintenance list, shared by the panel-wide list and an app's tab (which leaves the
 * app column out). The window is the one it runs in once chosen — else the first offered, marked as
 * a proposal — always on the service's clock, Santiago, whatever zone the browser is in.
 */
export const MaintenanceTable = ({
  rows,
  showApp = true,
  caption,
  className,
}: {
  rows: Maintenance[];
  showApp?: boolean;
  caption: string;
  className?: string;
}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const navigate = useNavigate();
  const {timezone} = useServiceVocabulary();
  const language = i18n.language;

  const columns = useMemo<Column<Maintenance>[]>(() => {
    const list: Column<Maintenance>[] = [
      {
        key: "maintenance",
        header: t("maintenances.columns.maintenance"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-text">
              <span className="truncate">{row.title}</span>
              {row.kind === "security" && <MaintenanceKindBadge value={row.kind} />}
            </p>
            <p className="truncate text-[12px] text-neutral-500">
              {[formatMinutes(row.estimated_minutes), row.release ? `v${row.release.version}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        ),
      },
    ];
    if (showApp) {
      list.push({
        key: "app",
        header: t("maintenances.columns.app"),
        className: "w-52",
        hideBelowLg: true,
        cell: (row) => (
          <div className="min-w-0 text-[12px]">
            <p className="truncate text-[13px] text-neutral-300">{row.app_name ?? row.app_id}</p>
            <p className="truncate text-neutral-500">{row.company_name}</p>
          </div>
        ),
      });
    }
    list.push(
      {
        key: "status",
        header: t("maintenances.columns.status"),
        className: "w-40",
        cell: (row) => (
          <span className="flex flex-col items-start gap-1">
            <MaintenanceStatusBadge value={row.status} rejected={row.rejected} />
            {row.auto_applied && row.status === "scheduled" && (
              <span className="text-[11px] text-neutral-500">{t("maintenances.auto_applied_short")}</span>
            )}
          </span>
        ),
      },
      {
        key: "window",
        header: t("maintenances.columns.window"),
        className: "w-64",
        cell: (row) => {
          const window = leadingWindow(row);
          if (!window) return <span className="text-[13px] text-neutral-600">{t("maintenances.no_windows_short")}</span>;
          return (
            <div className="text-[13px]">
              <p className={row.chosen_window ? "text-neutral-200" : "text-neutral-400"}>
                {formatZonedWindow(window.starts_at, window.ends_at, language, timezone)}
              </p>
              {!row.chosen_window && (
                <p className="text-[11px] text-neutral-500">{t("maintenances.windows_offered", {count: row.windows.length})}</p>
              )}
            </div>
          );
        },
      },
      {
        key: "sends",
        header: t("maintenances.columns.sends"),
        className: "w-20 text-right tabular-nums",
        hideBelowLg: true,
        cell: (row) =>
          row.sends > 0 ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-neutral-300" title={t("maintenances.sends_title", {count: row.sends})}>
              <EnvelopeSimple size={13} aria-hidden="true" /> {row.sends}
            </span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
      },
      {
        key: "result",
        header: t("maintenances.columns.result"),
        className: "w-28",
        hideBelowLg: true,
        cell: (row) =>
          row.result === "succeeded" ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-emerald-300">
              <CheckCircle size={14} aria-hidden="true" /> {t("maintenances.results.succeeded")}
            </span>
          ) : row.result === "failed" ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-red-300">
              <XCircle size={14} aria-hidden="true" /> {t("maintenances.results.failed")}
            </span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
      },
    );
    return list;
  }, [language, showApp, t, timezone]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => navigate(customAppsRoute.maintenance(row.id))}
      caption={caption}
      className={className}
    />
  );
};
