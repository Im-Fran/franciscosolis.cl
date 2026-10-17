import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowClockwise, CheckCircle, ListChecks} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatBytes, formatDuration} from "@/lib/custom-apps/format.ts";
import type {Installation} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {Pill} from "@/pages/custom-apps/components/badges.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {releaseLine} from "@/pages/custom-apps/components/releases/release-format.ts";
import {useReportColumns} from "@/pages/custom-apps/components/releases/report-columns.tsx";

const PAGE_SIZE = 10;

/**
 * One device's updater: what it would be offered right now, and every step it reported.
 *
 * The offer is computed by the service exactly as the device would read it, so this is the answer
 * to "why has that kiosk not updated" — nothing offered (its line has nothing newer that reaches it,
 * or the app is in grace or suspended), an ordinary update, a mandatory one because it runs below
 * the minimum version, or a rollback because the version it runs was withdrawn.
 */
export const InstallationUpdates = ({installation}: {installation: Installation}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const [offset, setOffset] = useState(0);
  const updates = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.installations.updates(installation.id, {limit: PAGE_SIZE, offset}, signal),
      [installation.id, offset],
    ),
  );
  const columns = useReportColumns({withDevice: false, withVersion: true});

  const offer = updates.data?.data.offer ?? null;
  const reports = updates.data?.data.reports ?? [];

  return (
    <Panel
      title={t("custom_apps:installation_updates.title")}
      description={t("custom_apps:installation_updates.description")}
      action={
        <Button variant="ghost" size="sm" onClick={updates.reload} disabled={updates.loading}>
          <ArrowClockwise size={14} className={updates.loading ? "animate-spin" : undefined} />
          {t("admin:common.refresh")}
        </Button>
      }
    >
      <PanelState loading={updates.loading && !updates.data} error={updates.data ? null : updates.error} onRetry={updates.reload} ns="admin">
        <div className="flex flex-col gap-6">
          {offer ? (
            <div className="rounded-[var(--radius-md)] border border-neutral-800 px-4 py-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-text">
                  {t("custom_apps:installation_updates.offer", {version: offer.version})}
                </span>
                {offer.rollback && <Pill tone="bad">{t("custom_apps:installation_updates.rollback")}</Pill>}
                {offer.mandatory && <Pill tone="pending">{t("custom_apps:installation_updates.mandatory")}</Pill>}
                <Link to={customAppsRoute.release(offer.release_id)} className="ml-auto text-[13px] text-neutral-400 underline hover:text-text">
                  {t("custom_apps:installation_updates.open_release")}
                </Link>
              </div>
              {(offer.rollback || offer.mandatory) && (
                <p className="mb-4 text-[13px] leading-relaxed text-neutral-400">
                  {offer.rollback
                    ? t("custom_apps:installation_updates.rollback_hint")
                    : t("custom_apps:installation_updates.mandatory_hint", {min: offer.min_version ?? "—"})}
                </p>
              )}
              <DetailList>
                <Detail label={t("custom_apps:releases.columns.line")}>{releaseLine(offer, t)}</Detail>
                <Detail label={t("custom_apps:release.filename")} mono>
                  {offer.filename}
                </Detail>
                <Detail label={t("custom_apps:release.size")}>{formatBytes(offer.size_bytes, language)}</Detail>
                <Detail label={t("custom_apps:release.min_version")} mono>
                  {offer.min_version}
                </Detail>
                <Detail label={t("custom_apps:release.published_at")}>{formatDateTime(offer.published_at, language)}</Detail>
                <Detail label={t("custom_apps:installation_updates.health")}>
                  {t("custom_apps:installation_updates.health_value", {
                    duration: formatDuration(offer.health_check_timeout_seconds),
                    count: offer.max_failures,
                  })}
                </Detail>
              </DetailList>
            </div>
          ) : (
            updates.data && (
              <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-400">
                <CheckCircle size={18} className="mt-px shrink-0 text-neutral-600" aria-hidden="true" />
                <span>
                  {t("custom_apps:installation_updates.no_offer", {version: installation.app_version ?? "—"})}
                </span>
              </p>
            )
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium tracking-wide text-neutral-500 uppercase">
              {t("custom_apps:installation_updates.reports_title")}
            </h3>
            {reports.length === 0 ? (
              <EmptyState icon={<ListChecks size={28} />} title={t("custom_apps:installation_updates.reports_empty")} />
            ) : (
              <DataTable
                columns={columns}
                rows={reports}
                rowKey={(row) => String(row.id)}
                caption={t("custom_apps:installation_updates.reports_title")}
                className={updates.loading ? "opacity-60 transition-opacity" : undefined}
              />
            )}
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              count={reports.length}
              total={updates.data?.pagination.total}
              onChange={setOffset}
              disabled={updates.loading}
            />
          </div>
        </div>
      </PanelState>
    </Panel>
  );
};
