import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {CalendarBlank, Plus, Wrench} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {WithHelp} from "@/components/ui/help.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {MaintenanceStatusFilter} from "@/lib/custom-apps/types.ts";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {MaintenanceDialog} from "@/pages/custom-apps/components/maintenances/maintenance-dialog.tsx";
import {MaintenanceTable} from "@/pages/custom-apps/components/maintenances/maintenance-table.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const PAGE_SIZE = 25;

/**
 * The app's maintenances tab: every maintenance planned for this app, newest first, and the button
 * that plans the next one. Not a module — a maintenance works through the kill switch and, when it
 * carries a release, the updater — so the tab is always there. A new maintenance is created as a
 * draft and opens on its own page, where its windows are offered.
 */
export const AppMaintenances = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {app} = useApp();
  const help = useHelp();
  const navigate = useNavigate();
  const {notify} = useToast();
  const {maintenanceStatuses} = useServiceVocabulary();
  const [status, setStatus] = useState<MaintenanceStatusFilter | "">("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);

  const maintenances = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.maintenances.listForApp(app.id, {status: status || undefined, limit: PAGE_SIZE, offset}, signal),
      [app.id, status, offset],
    ),
  );
  const rows = maintenances.data?.data ?? [];

  return (
    <>
      <Panel
        title={t("custom_apps:maintenances.app_title")}
        description={
          maintenances.data
            ? t("custom_apps:maintenances.count", {count: maintenances.data.pagination.total})
            : t("custom_apps:maintenances.app_description")
        }
        action={
          <>
            <Link
              to={customAppsRoute.maintenances({app_id: app.id, view: "calendar"})}
              className="inline-flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-text hover:underline"
            >
              <CalendarBlank size={14} aria-hidden="true" /> {t("custom_apps:maintenances.open_calendar")}
            </Link>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} /> {t("custom_apps:maintenances.new")}
            </Button>
          </>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <WithHelp label={t("custom_apps:maintenances.filters.status")} help={help.field("maintenances.filter_help.status")}>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as MaintenanceStatusFilter | "");
                setOffset(0);
              }}
              aria-label={t("custom_apps:maintenances.filters.status")}
              className="h-9 w-auto min-w-[12rem] text-[13px]"
            >
              <option value="">{t("custom_apps:maintenances.filters.any_status")}</option>
              <option value="upcoming">{t("custom_apps:maintenances.filters.upcoming")}</option>
              <option value="pending">{t("custom_apps:maintenances.filters.pending")}</option>
              {maintenanceStatuses.map((value) => (
                <option key={value} value={value}>
                  {t(`custom_apps:maintenance_statuses.${value}`, {defaultValue: value})}
                </option>
              ))}
            </Select>
          </WithHelp>
        </div>

        <PanelState loading={maintenances.loading && !maintenances.data} error={maintenances.data ? null : maintenances.error} onRetry={maintenances.reload} ns="admin">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Wrench size={28} />}
              title={status ? t("custom_apps:maintenances.no_matches") : t("custom_apps:maintenances.app_empty")}
              description={status ? undefined : t("custom_apps:maintenances.app_empty_description")}
              action={
                status ? undefined : (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus size={14} /> {t("custom_apps:maintenances.new")}
                  </Button>
                )
              }
            />
          ) : (
            <MaintenanceTable
              rows={rows}
              showApp={false}
              caption={t("custom_apps:maintenances.app_title")}
              className={maintenances.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={maintenances.data?.pagination.total}
            onChange={setOffset}
            disabled={maintenances.loading}
          />
        </PanelState>
      </Panel>

      {creating && (
        <MaintenanceDialog
          open
          appId={app.id}
          maintenance={null}
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            notify(t("custom_apps:maintenances.created"));
            navigate(customAppsRoute.maintenance(created.id));
          }}
        />
      )}
    </>
  );
};
