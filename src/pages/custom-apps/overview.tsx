import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {
  AddressBook,
  AppWindow,
  ArrowClockwise,
  Bell,
  Buildings,
  CalendarCheck,
  CalendarX,
  ChatCircleDots,
  CheckCircle,
  FileText,
  HourglassLow,
  Lifebuoy,
  Package,
  Plugs,
  Prohibit,
  Receipt,
  Timer,
  Users,
  Warning,
  WarningOctagon,
  Wrench,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {addDays, dayIn} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import {APP_STATES} from "@/lib/custom-apps/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StateBadge} from "@/pages/custom-apps/components/badges.tsx";
import {InstallationRow} from "@/pages/custom-apps/components/installation-row.tsx";
import {StatCard} from "@/pages/custom-apps/components/stat-card.tsx";

/** Often enough that "connected" means now, rarely enough that a forgotten tab costs nothing much. */
const REFRESH_MS = 30_000;

/**
 * What the panel opens on: how many installations are connected right now, which ones are waiting
 * for a look, what was enrolled lately — and, beside the contracts, the support tickets waiting on
 * us, waiting on the client and not opened yet, and the scheduled maintenances waiting on a client,
 * starting this week, running, or needing somebody.
 *
 * It is one request — the service aggregates — so the whole screen loads and refreshes as one, and
 * a refresh keeps the figures on screen rather than flashing a spinner every thirty seconds.
 */
export const Overview = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const overview = useResource(useCallback((signal: AbortSignal) => customAppsApi.overview(signal), []));
  const {timezone} = useServiceVocabulary();
  const today = dayIn(new Date(), timezone);
  useAutoRefresh(overview.reload, REFRESH_MS);

  const data = overview.data;

  return (
    <>
      <PageHeader
        title={t("custom_apps:overview.title")}
        description={t("custom_apps:overview.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={overview.reload} disabled={overview.loading}>
            <ArrowClockwise size={14} className={overview.loading ? "animate-spin" : undefined} />
            {t("admin:common.refresh")}
          </Button>
        }
      />

      <PanelState
        loading={overview.loading && !data}
        error={data ? null : overview.error}
        forbidden={overview.status === 403}
        onRetry={overview.reload}
        ns="admin"
      >
        {data && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t("custom_apps:overview.connected")}
                icon={<Plugs size={18} />}
                value={
                  <>
                    {data.installations.connected}
                    <span className="text-[18px] text-neutral-500"> / {data.installations.active}</span>
                  </>
                }
                detail={t("custom_apps:overview.connected_detail", {total: data.installations.total})}
              />
              <StatCard
                label={t("custom_apps:overview.needs_review")}
                icon={<Warning size={18} />}
                value={data.installations.needs_review}
                attention={data.installations.needs_review > 0}
                detail={t("custom_apps:overview.needs_review_detail")}
              />
              <StatCard
                label={t("custom_apps:overview.alerts")}
                icon={<Bell size={18} />}
                value={data.alerts?.unresolved ?? 0}
                attention={(data.alerts?.unresolved ?? 0) > 0}
                detail={t("custom_apps:overview.alerts_detail")}
                to={customAppsRoute.alerts({status: "unresolved"})}
              />
              <StatCard
                label={t("custom_apps:overview.revoked")}
                icon={<Prohibit size={18} />}
                value={data.installations.revoked}
                detail={t("custom_apps:overview.revoked_detail")}
              />
            </div>

            <div className={data.releases ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
              <StatCard
                label={t("custom_apps:overview.apps")}
                icon={<AppWindow size={18} />}
                value={data.apps.total}
                to={customAppsRoute.apps}
                detail={
                  <span className="flex flex-wrap gap-1.5">
                    {APP_STATES.filter((state) => (data.apps.by_state?.[state] ?? 0) > 0).map((state) => (
                      <StateBadge key={state} state={state} count={data.apps.by_state[state]} />
                    ))}
                  </span>
                }
              />
              <StatCard
                label={t("custom_apps:overview.companies")}
                icon={<Buildings size={18} />}
                value={data.companies.total}
                to={customAppsRoute.companies}
              />
              <StatCard
                label={t("custom_apps:overview.contacts")}
                icon={<AddressBook size={18} />}
                value={data.contacts.total}
                to={customAppsRoute.contacts}
              />
              {/* Releases live under each app, so the card counts rather than links. */}
              {data.releases && (
                <StatCard
                  label={t("custom_apps:overview.releases")}
                  icon={<Package size={18} />}
                  value={data.releases.rolling_out}
                  attention={data.releases.paused > 0}
                  detail={t("custom_apps:overview.releases_detail", {
                    paused: data.releases.paused,
                    drafts: data.releases.drafts,
                  })}
                />
              )}
            </div>

            {/* Contracts and cycles: optional, so a service that predates them still renders. */}
            {(data.contracts || data.cycles) && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {data.contracts && (
                  <>
                    <StatCard
                      label={t("custom_apps:overview.contracts_active")}
                      icon={<FileText size={18} />}
                      value={data.contracts.active}
                      to={`${customAppsRoute.contracts}?status=active`}
                      detail={t("custom_apps:overview.contracts_active_detail")}
                    />
                    <StatCard
                      label={t("custom_apps:overview.contracts_expiring")}
                      icon={<CalendarX size={18} />}
                      value={data.contracts.expiring}
                      attention={data.contracts.expiring > 0}
                      to={`${customAppsRoute.contracts}?status=active`}
                      detail={t("custom_apps:overview.contracts_expiring_detail")}
                    />
                    <StatCard
                      label={t("custom_apps:overview.contracts_grace")}
                      icon={<Timer size={18} />}
                      value={data.contracts.in_grace}
                      attention={data.contracts.in_grace > 0}
                      to={`${customAppsRoute.contracts}?status=grace`}
                      detail={t("custom_apps:overview.contracts_grace_detail")}
                    />
                  </>
                )}
                {data.cycles && (
                  <>
                    <StatCard
                      label={t("custom_apps:overview.cycles_exceeded")}
                      icon={<HourglassLow size={18} />}
                      value={data.cycles.exceeded}
                      attention={data.cycles.exceeded > 0}
                      to={customAppsRoute.contracts}
                      detail={t("custom_apps:overview.cycles_exceeded_detail")}
                    />
                    <StatCard
                      label={t("custom_apps:overview.cycles_to_bill")}
                      icon={<Receipt size={18} />}
                      value={data.cycles.to_bill}
                      attention={data.cycles.to_bill > 0}
                      to={customAppsRoute.contracts}
                      detail={t("custom_apps:overview.cycles_to_bill_detail")}
                    />
                  </>
                )}
              </div>
            )}

            {/* Support tickets: optional, so a service that predates them still renders. */}
            {data.tickets && (
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label={t("custom_apps:overview.tickets_open")}
                  icon={<Lifebuoy size={18} />}
                  value={data.tickets.open}
                  attention={data.tickets.open > 0}
                  to={customAppsRoute.tickets({status: "open"})}
                  detail={t("custom_apps:overview.tickets_open_detail")}
                />
                <StatCard
                  label={t("custom_apps:overview.tickets_pending")}
                  icon={<Users size={18} />}
                  value={data.tickets.pending}
                  to={customAppsRoute.tickets({status: "pending"})}
                  detail={t("custom_apps:overview.tickets_pending_detail")}
                />
                <StatCard
                  label={t("custom_apps:overview.tickets_unread")}
                  icon={<ChatCircleDots size={18} />}
                  value={data.tickets.unread}
                  attention={data.tickets.unread > 0}
                  to={customAppsRoute.tickets()}
                  detail={t("custom_apps:overview.tickets_unread_detail")}
                />
              </div>
            )}

            {/* Scheduled maintenances: optional, so a service that predates them still renders. */}
            {data.maintenances && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label={t("custom_apps:overview.maintenances_pending")}
                  icon={<EnvelopeSimple size={18} />}
                  value={data.maintenances.pending_approval}
                  to={customAppsRoute.maintenances({status: "pending"})}
                  detail={t("custom_apps:overview.maintenances_pending_detail")}
                />
                <StatCard
                  label={t("custom_apps:overview.maintenances_upcoming")}
                  icon={<CalendarCheck size={18} />}
                  value={data.maintenances.upcoming}
                  to={customAppsRoute.maintenances({status: "scheduled", from: today, to: addDays(today, 7)})}
                  detail={t("custom_apps:overview.maintenances_upcoming_detail")}
                />
                <StatCard
                  label={t("custom_apps:overview.maintenances_in_progress")}
                  icon={<Wrench size={18} />}
                  value={data.maintenances.in_progress}
                  to={customAppsRoute.maintenances({status: "in_progress"})}
                  detail={t("custom_apps:overview.maintenances_in_progress_detail")}
                />
                <StatCard
                  label={t("custom_apps:overview.maintenances_attention")}
                  icon={<WarningOctagon size={18} />}
                  value={data.maintenances.needs_attention}
                  attention={data.maintenances.needs_attention > 0}
                  to={customAppsRoute.maintenances({status: "attention"})}
                  detail={t("custom_apps:overview.maintenances_attention_detail")}
                />
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title={t("custom_apps:overview.review_title")} description={t("custom_apps:overview.review_description")}>
                {data.needs_review.length === 0 ? (
                  <EmptyState icon={<CheckCircle size={28} />} title={t("custom_apps:overview.review_empty")} />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.needs_review.map((installation) => (
                      <InstallationRow key={installation.id} installation={installation} when="enrolled" />
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title={t("custom_apps:overview.recent_title")} description={t("custom_apps:overview.recent_description")}>
                {data.recent_installations.length === 0 ? (
                  <EmptyState icon={<Plugs size={28} />} title={t("custom_apps:overview.recent_empty")} />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.recent_installations.map((installation) => (
                      <InstallationRow key={installation.id} installation={installation} when="enrolled" />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        )}
      </PanelState>
    </>
  );
};
