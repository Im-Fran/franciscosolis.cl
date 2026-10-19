import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useSearchParams} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {ArrowClockwise, Lifebuoy, X} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatLastSeen, formatMinutes} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {Ticket, TicketStatusFilter} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {AppSelect} from "@/pages/custom-apps/components/alerts/app-select.tsx";
import {CompanySelect} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";
import {TicketStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {UnreadCount} from "@/pages/custom-apps/components/tickets/ticket-row.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {WithHelp} from "@/components/ui/help.tsx";

const PAGE_SIZE = 50;
const REFRESH_MS = 30_000;
const DEFAULT_STATUS: TicketStatusFilter = "active";

/**
 * The support inbox: every ticket opened from inside a client's app, most recently active first,
 * opening on the ones that still need somebody — `open` (waiting on us) and `pending` (waiting on
 * the client).
 *
 * The filters live in the address like the alert inbox's, so "the tickets of that app" or "of that
 * device" is a link: the app summary, its settings and an installation's page all point here
 * filtered to themselves. The search runs on the service and takes `#42` for a ticket number. It
 * refreshes every thirty seconds, because an inbox that was right when it loaded is not one.
 */
export const Tickets = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const {ticketStatuses} = useServiceVocabulary();
  const help = useHelp();
  const [params, setParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debounced] = useDebounceValue(search.trim(), 300);
  const language = i18n.language;

  const status = (params.get("status") as TicketStatusFilter | "all" | null) ?? DEFAULT_STATUS;
  const appId = params.get("app_id") ?? "";
  const companyId = params.get("company_id") ?? "";
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

  const tickets = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.tickets.list(
          {
            status: status === "all" ? undefined : status,
            app_id: appId || undefined,
            company_id: companyId || undefined,
            installation_id: installationId || undefined,
            search: debounced || undefined,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [status, appId, companyId, installationId, debounced, offset],
    ),
  );
  useAutoRefresh(tickets.reload, REFRESH_MS);

  const rows = tickets.data?.data ?? [];
  const filtered = status !== DEFAULT_STATUS || Boolean(appId || companyId || installationId || debounced);

  const columns = useMemo<Column<Ticket>[]>(
    () => [
      {
        key: "ticket",
        header: t("custom_apps:tickets.columns.ticket"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-2 text-sm text-text">
              <span className="shrink-0 font-mono text-[13px] text-neutral-500">#{row.number}</span>
              <span className={row.unread > 0 ? "truncate font-medium" : "truncate"}>{row.subject}</span>
              <UnreadCount count={row.unread} />
            </p>
            <p className="truncate text-[12px] text-neutral-500">
              {[row.requester_name, row.requester_email].filter(Boolean).join(" · ") || t("custom_apps:tickets.anonymous")}
            </p>
          </div>
        ),
      },
      {
        key: "app",
        header: t("custom_apps:tickets.columns.app"),
        className: "w-56",
        hideBelowLg: true,
        cell: (row) => (
          <div className="min-w-0 text-[12px]">
            <p className="truncate text-[13px] text-neutral-300">{row.app_name ?? row.app_id}</p>
            <p className="truncate text-neutral-500">{row.company_name}</p>
            {row.installation_name && <p className="truncate text-neutral-600">{row.installation_name}</p>}
          </div>
        ),
      },
      {
        key: "status",
        header: t("custom_apps:tickets.columns.status"),
        className: "w-44",
        cell: (row) => (
          <span className="flex flex-col items-start gap-1">
            <TicketStatusBadge value={row.status} />
            {row.last_message_by && (row.status === "open" || row.status === "pending") && (
              <span className="text-[12px] text-neutral-500">
                {row.last_message_by === "requester" ? t("custom_apps:tickets.turn_requester") : t("custom_apps:tickets.turn_staff")}
              </span>
            )}
          </span>
        ),
      },
      {
        key: "activity",
        header: t("custom_apps:tickets.columns.activity"),
        className: "w-36",
        cell: (row) => {
          const when = row.last_message_at ?? row.created_at;
          return (
            <time dateTime={when} title={formatDateTime(when, language) ?? undefined}>
              {formatLastSeen(when, language)}
            </time>
          );
        },
      },
      {
        key: "time",
        header: t("custom_apps:tickets.columns.time"),
        className: "w-28 text-right tabular-nums",
        hideBelowLg: true,
        cell: (row) =>
          row.logged_minutes > 0 ? (
            <span className="text-text">{formatMinutes(row.logged_minutes)}</span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
      },
    ],
    [language, t],
  );

  return (
    <>
      <PageHeader
        title={t("custom_apps:tickets.title")}
        description={t("custom_apps:tickets.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={tickets.reload} disabled={tickets.loading}>
            <ArrowClockwise size={14} className={tickets.loading ? "animate-spin" : undefined} />
            {t("admin:common.refresh")}
          </Button>
        }
      />

      <Panel
        title={t("custom_apps:tickets.panel_title")}
        description={tickets.data ? t("custom_apps:tickets.count", {count: tickets.data.pagination.total}) : undefined}
      >
        <div className="mb-5 flex flex-col gap-3">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setOffset(0);
            }}
            placeholder={t("custom_apps:tickets.search")}
            help={help.field("tickets.filter_help.search")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <WithHelp label={t("custom_apps:tickets.filters.status")} help={help.field("tickets.filter_help.status")}>
              <Select
                value={status}
                onChange={(event) => setFilter("status", event.target.value === DEFAULT_STATUS ? "" : event.target.value)}
                aria-label={t("custom_apps:tickets.filters.status")}
                className="w-auto min-w-[12rem]"
              >
                <option value="active">{t("custom_apps:tickets.filters.active")}</option>
                {ticketStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(`custom_apps:ticket_statuses.${value}`, {defaultValue: value})}
                  </option>
                ))}
                <option value="all">{t("custom_apps:tickets.filters.all")}</option>
              </Select>
            </WithHelp>
            <WithHelp label={t("custom_apps:tickets.app")} help={help.field("tickets.filter_help.app")}>
              <AppSelect
                value={appId}
                onChange={(value) => setFilter("app_id", value)}
                emptyLabel={t("custom_apps:tickets.filters.any_app")}
                className="w-auto min-w-[14rem]"
              />
            </WithHelp>
            <WithHelp label={t("custom_apps:tickets.company")} help={help.field("tickets.filter_help.company")} className="w-full sm:w-64">
              <CompanySelect
                id="tickets-filter-company"
                value={companyId}
                onChange={(value) => setFilter("company_id", value)}
                emptyLabel={t("custom_apps:tickets.filters.any_company")}
              />
            </WithHelp>
            {installationId && (
              <Button variant="secondary" size="sm" onClick={() => setFilter("installation_id", "")}>
                {t("custom_apps:tickets.filters.one_installation")}
                <X size={12} aria-label={t("admin:common.clear_filters")} />
              </Button>
            )}
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOffset(0);
                  setSearch("");
                  setParams(new URLSearchParams(), {replace: true});
                }}
              >
                {t("admin:common.clear_filters")}
              </Button>
            )}
          </div>
        </div>

        <PanelState
          loading={tickets.loading && !tickets.data}
          error={tickets.data ? null : tickets.error}
          forbidden={tickets.status === 403}
          onRetry={tickets.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={<Lifebuoy size={28} />}
              title={filtered ? t("custom_apps:tickets.no_matches") : t("custom_apps:tickets.empty")}
              description={filtered ? undefined : t("custom_apps:tickets.empty_description")}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(customAppsRoute.ticket(row.id))}
              caption={t("custom_apps:tickets.panel_title")}
              className={tickets.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={tickets.data?.pagination.total}
            onChange={setOffset}
            disabled={tickets.loading}
          />
        </PanelState>
      </Panel>
    </>
  );
};
