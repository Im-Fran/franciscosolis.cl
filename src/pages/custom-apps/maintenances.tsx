import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "react-router-dom";
import {ArrowClockwise, CalendarBlank, CaretLeft, CaretRight, ListBullets, Wrench} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {WithHelp} from "@/components/ui/help.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {addDays, dayIn} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {Maintenance, MaintenanceKind, MaintenanceQuery, MaintenanceStatusFilter, Page} from "@/lib/custom-apps/types.ts";
import {zonedDayStart} from "@/lib/custom-apps/zoned-time.ts";
import {cn} from "@/lib/utils.ts";
import {AppSelect} from "@/pages/custom-apps/components/alerts/app-select.tsx";
import {CompanySelect} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {MaintenanceCalendar} from "@/pages/custom-apps/components/maintenances/maintenance-calendar.tsx";
import {needsAttention, shiftMonth} from "@/pages/custom-apps/components/maintenances/maintenance-format.ts";
import {MaintenanceTable} from "@/pages/custom-apps/components/maintenances/maintenance-table.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const PAGE_SIZE = 50;
const REFRESH_MS = 60_000;
/** A month of windows fits in one page of the service's largest. */
const CALENDAR_LIMIT = 200;

/** The list's status filter: the service's statuses and groupings, plus `attention`, which this screen builds. */
type StatusFilter = MaintenanceStatusFilter | "attention" | "";

/**
 * "Needs attention" is three questions on the service — nobody answered, failed lately, sent back by
 * the client — so it is asked as three and merged here, newest change first. A hundred of each is
 * far more than will ever wait on somebody at once.
 */
const loadAttention = async (filters: Omit<MaintenanceQuery, "status" | "limit" | "offset">, signal: AbortSignal): Promise<Page<Maintenance>> => {
  const [noResponse, failed, drafts] = await Promise.all(
    (["no_response", "failed", "draft"] as const).map((status) => customAppsApi.maintenances.list({...filters, status, limit: 100}, signal)),
  );
  const now = Date.now();
  const rows = [...noResponse.data, ...failed.data, ...drafts.data]
    .filter((row) => needsAttention(row, now))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return {code: 200, data: rows, pagination: {limit: rows.length, offset: 0, total: rows.length}};
};

/**
 * Every scheduled maintenance across the apps — a list newest first, or a month of windows.
 *
 * The filters live in the address like the other inboxes', so the overview's cards are links to a
 * filtered list: waiting on the client, scheduled in the next seven days, running, needing attention.
 * `from`/`to` keep the maintenances whose window (the chosen one, or any offered) overlaps those
 * days, which is also how the calendar asks for its month. Days and times are Santiago's, the
 * service's clock, whatever zone the browser is in.
 */
export const Maintenances = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {maintenanceStatuses, maintenanceKinds, timezone} = useServiceVocabulary();
  const [params, setParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const language = i18n.language;

  const status = (params.get("status") ?? "") as StatusFilter;
  const kind = (params.get("kind") ?? "") as MaintenanceKind | "";
  const appId = params.get("app_id") ?? "";
  const companyId = params.get("company_id") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const view = params.get("view") === "calendar" ? "calendar" : "list";
  const today = dayIn(new Date(), timezone);
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : today.slice(0, 7);

  const setFilter = (entries: Record<string, string>) => {
    setOffset(0);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(entries)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      {replace: true},
    );
  };

  const range = useMemo(() => {
    if (view === "calendar") {
      return {from: zonedDayStart(`${month}-01`, timezone) ?? undefined, to: zonedDayStart(`${shiftMonth(month, 1)}-01`, timezone) ?? undefined};
    }
    return {
      from: from ? (zonedDayStart(from, timezone) ?? undefined) : undefined,
      /* "To the 3rd" includes the whole of the 3rd. */
      to: to ? (zonedDayStart(addDays(to, 1), timezone) ?? undefined) : undefined,
    };
  }, [view, month, from, to, timezone]);

  const maintenances = useResource(
    useCallback(
      (signal: AbortSignal) => {
        const filters = {kind: kind || undefined, app_id: appId || undefined, company_id: companyId || undefined, ...range};
        if (status === "attention") return loadAttention(filters, signal);
        return customAppsApi.maintenances.list(
          {
            ...filters,
            status: status || undefined,
            limit: view === "calendar" ? CALENDAR_LIMIT : PAGE_SIZE,
            offset: view === "calendar" ? 0 : offset,
          },
          signal,
        );
      },
      [status, kind, appId, companyId, range, view, offset],
    ),
  );
  useAutoRefresh(maintenances.reload, REFRESH_MS);

  const rows = maintenances.data?.data ?? [];
  const filtered = Boolean(status || kind || appId || companyId || from || to);
  const monthLabel = new Intl.DateTimeFormat(language, {month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(`${month}-15T12:00:00Z`));

  return (
    <>
      <PageHeader
        title={t("custom_apps:maintenances.title")}
        description={t("custom_apps:maintenances.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={maintenances.reload} disabled={maintenances.loading}>
            <ArrowClockwise size={14} className={maintenances.loading ? "animate-spin" : undefined} />
            {t("admin:common.refresh")}
          </Button>
        }
      />

      <Panel
        title={view === "calendar" ? t("custom_apps:maintenances.calendar.title") : t("custom_apps:maintenances.panel_title")}
        description={
          maintenances.data && view === "list" ? t("custom_apps:maintenances.count", {count: maintenances.data.pagination.total}) : t("custom_apps:maintenances.timezone_note", {timezone})
        }
        action={
          <div className="flex items-center gap-1" role="group" aria-label={t("custom_apps:maintenances.view_label")}>
            {(["list", "calendar"] as const).map((value) => {
              const Icon = value === "list" ? ListBullets : CalendarBlank;
              return (
                <Button
                  key={value}
                  variant={view === value ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={view === value}
                  onClick={() => setFilter({view: value === "list" ? "" : value})}
                >
                  <Icon size={14} /> {t(`custom_apps:maintenances.views.${value}`)}
                </Button>
              );
            })}
          </div>
        }
      >
        <div className="mb-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <WithHelp label={t("custom_apps:maintenances.filters.status")} help={help.field("maintenances.filter_help.status")}>
              <Select
                value={status}
                onChange={(event) => setFilter({status: event.target.value})}
                aria-label={t("custom_apps:maintenances.filters.status")}
                className="w-auto min-w-[12rem]"
              >
                <option value="">{t("custom_apps:maintenances.filters.any_status")}</option>
                <option value="upcoming">{t("custom_apps:maintenances.filters.upcoming")}</option>
                <option value="pending">{t("custom_apps:maintenances.filters.pending")}</option>
                <option value="attention">{t("custom_apps:maintenances.filters.attention")}</option>
                {maintenanceStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(`custom_apps:maintenance_statuses.${value}`, {defaultValue: value})}
                  </option>
                ))}
              </Select>
            </WithHelp>
            <WithHelp label={t("custom_apps:maintenances.filters.kind")} help={help.field("maintenances.filter_help.kind")}>
              <Select
                value={kind}
                onChange={(event) => setFilter({kind: event.target.value})}
                aria-label={t("custom_apps:maintenances.filters.kind")}
                className="w-auto min-w-[10rem]"
              >
                <option value="">{t("custom_apps:maintenances.filters.any_kind")}</option>
                {maintenanceKinds.map((value) => (
                  <option key={value} value={value}>
                    {t(`custom_apps:maintenance_kinds.${value}`, {defaultValue: value})}
                  </option>
                ))}
              </Select>
            </WithHelp>
            <WithHelp label={t("custom_apps:maintenances.filters.app")} help={help.field("maintenances.filter_help.app")}>
              <AppSelect
                value={appId}
                onChange={(value) => setFilter({app_id: value})}
                emptyLabel={t("custom_apps:maintenances.filters.any_app")}
                className="w-auto min-w-[14rem]"
              />
            </WithHelp>
            <WithHelp label={t("custom_apps:maintenances.filters.company")} help={help.field("maintenances.filter_help.company")} className="w-full sm:w-64">
              <CompanySelect
                id="maintenances-filter-company"
                value={companyId}
                onChange={(value) => setFilter({company_id: value})}
                emptyLabel={t("custom_apps:maintenances.filters.any_company")}
              />
            </WithHelp>
          </div>
          {view === "list" ? (
            <div className="flex flex-wrap items-center gap-3">
              <WithHelp label={t("custom_apps:maintenances.filters.from")} help={help.field("maintenances.filter_help.from")}>
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(event) => setFilter({from: event.target.value})}
                  aria-label={t("custom_apps:maintenances.filters.from")}
                  className="h-9 w-auto text-[13px]"
                />
              </WithHelp>
              <WithHelp label={t("custom_apps:maintenances.filters.to")} help={help.field("maintenances.filter_help.to")}>
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setFilter({to: event.target.value})}
                  aria-label={t("custom_apps:maintenances.filters.to")}
                  className="h-9 w-auto text-[13px]"
                />
              </WithHelp>
              {filtered && (
                <Button variant="ghost" size="sm" onClick={() => setFilter({status: "", kind: "", app_id: "", company_id: "", from: "", to: ""})}>
                  {t("admin:common.clear_filters")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setFilter({month: shiftMonth(month, -1)})} aria-label={t("custom_apps:maintenances.calendar.previous")}>
                <CaretLeft size={14} />
              </Button>
              <h3 className="min-w-[10rem] text-center text-sm text-text first-letter:uppercase" aria-live="polite">
                {monthLabel}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setFilter({month: shiftMonth(month, 1)})} aria-label={t("custom_apps:maintenances.calendar.next")}>
                <CaretRight size={14} />
              </Button>
              {month !== today.slice(0, 7) && (
                <Button variant="ghost" size="sm" onClick={() => setFilter({month: ""})}>
                  {t("custom_apps:maintenances.calendar.today")}
                </Button>
              )}
              {filtered && (
                <Button variant="ghost" size="sm" onClick={() => setFilter({status: "", kind: "", app_id: "", company_id: ""})}>
                  {t("admin:common.clear_filters")}
                </Button>
              )}
            </div>
          )}
        </div>

        <PanelState
          loading={maintenances.loading && !maintenances.data}
          error={maintenances.data ? null : maintenances.error}
          forbidden={maintenances.status === 403}
          onRetry={maintenances.reload}
          ns="admin"
        >
          {view === "calendar" ? (
            <div className={cn(maintenances.loading && "opacity-60 transition-opacity")}>
              <MaintenanceCalendar month={month} maintenances={rows} timezone={timezone} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Wrench size={28} />}
              title={filtered ? t("custom_apps:maintenances.no_matches") : t("custom_apps:maintenances.empty")}
              description={filtered ? undefined : t("custom_apps:maintenances.empty_description")}
            />
          ) : (
            <MaintenanceTable
              rows={rows}
              caption={t("custom_apps:maintenances.panel_title")}
              className={maintenances.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}
          {view === "list" && status !== "attention" && (
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              count={rows.length}
              total={maintenances.data?.pagination.total}
              onChange={setOffset}
              disabled={maintenances.loading}
            />
          )}
        </PanelState>
      </Panel>
    </>
  );
};
