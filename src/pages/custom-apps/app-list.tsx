import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {AppWindow, ArrowClockwise, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {AppSummary} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {CompanySelect} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {StateBadge} from "@/pages/custom-apps/components/badges.tsx";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {WithHelp} from "@/components/ui/help.tsx";

const PAGE_SIZE = 50;

/**
 * Every app built for a client, across clients. The filters are the service's — state, kind,
 * company and a name search — so they narrow the whole inventory, not the loaded page.
 */
export const AppList = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const navigate = useNavigate();
  const vocabulary = useServiceVocabulary();
  const [search, setSearch] = useState("");
  const [debounced] = useDebounceValue(search.trim(), 300);
  const [state, setState] = useState("");
  const [kind, setKind] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [offset, setOffset] = useState(0);

  const apps = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.apps.list(
          {search: debounced, state, kind, company_id: companyId, limit: PAGE_SIZE, offset},
          signal,
        ),
      [debounced, state, kind, companyId, offset],
    ),
  );

  const rows = apps.data?.data ?? [];
  const total = apps.data?.pagination.total ?? 0;
  const filtered = Boolean(debounced || state || kind || companyId);

  /** Any filter change starts again from the first page, or the new filter could open on an empty one. */
  const filter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  const columns = useMemo<Column<AppSummary>[]>(
    () => [
      {
        key: "name",
        header: t("custom_apps:apps.columns.name"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{row.name}</p>
            <p className="truncate text-[12px] text-neutral-500">
              {row.company?.trade_name || row.company?.legal_name || ""}
            </p>
          </div>
        ),
      },
      {
        key: "kind",
        header: t("custom_apps:apps.columns.kind"),
        className: "w-28",
        cell: (row) => t(`custom_apps:kinds.${row.kind}`, {defaultValue: row.kind}),
      },
      {
        key: "state",
        header: t("custom_apps:apps.columns.state"),
        className: "w-32",
        cell: (row) => <StateBadge state={row.state} />,
      },
      {
        key: "installations",
        header: t("custom_apps:apps.columns.installations"),
        className: "w-40",
        cell: (row) => (
          <span className="tabular-nums">
            <span className={row.connected_count > 0 ? "text-emerald-300" : "text-neutral-500"}>{row.connected_count}</span>
            <span className="text-neutral-500"> / {row.installation_count}</span>
          </span>
        ),
      },
      {
        key: "updated",
        header: t("custom_apps:apps.columns.updated"),
        className: "w-32",
        hideBelowLg: true,
        cell: (row) => formatDate(row.updated_at, i18n.language),
      },
    ],
    [i18n.language, t],
  );

  return (
    <>
      <PageHeader
        title={t("custom_apps:apps.title")}
        description={t("custom_apps:apps.description")}
        actions={
          <Button asChild>
            <Link to={customAppsRoute.appNew()}>
              <Plus size={16} /> {t("custom_apps:apps.new")}
            </Link>
          </Button>
        }
      />

      <Panel
        title={t("custom_apps:apps.panel_title")}
        description={apps.data ? t("custom_apps:apps.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={apps.reload}>
            <ArrowClockwise size={14} /> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <SearchBox
            value={search}
            onChange={(value) => filter(() => setSearch(value))}
            placeholder={t("custom_apps:apps.search")}
            help={help.field("apps.filter_help.search")}
          />
          <WithHelp label={t("custom_apps:apps.filters.state")} help={help.field("apps.filter_help.state")}>
            <Select
              value={state}
              onChange={(event) => filter(() => setState(event.target.value))}
              aria-label={t("custom_apps:apps.filters.state")}
              className="w-auto min-w-[9rem]"
            >
              <option value="">{t("custom_apps:apps.filters.any_state")}</option>
              {vocabulary.states.map((value) => (
                <option key={value} value={value}>
                  {t(`custom_apps:states.${value}`, {defaultValue: value})}
                </option>
              ))}
            </Select>
          </WithHelp>
          <WithHelp label={t("custom_apps:apps.filters.kind")} help={help.field("apps.filter_help.kind")}>
            <Select
              value={kind}
              onChange={(event) => filter(() => setKind(event.target.value))}
              aria-label={t("custom_apps:apps.filters.kind")}
              className="w-auto min-w-[9rem]"
            >
              <option value="">{t("custom_apps:apps.filters.any_kind")}</option>
              {vocabulary.kinds.map((value) => (
                <option key={value} value={value}>
                  {t(`custom_apps:kinds.${value}`, {defaultValue: value})}
                </option>
              ))}
            </Select>
          </WithHelp>
          <WithHelp label={t("custom_apps:apps.fields.company")} help={help.field("apps.filter_help.company")} className="w-full sm:w-64">
            <CompanySelect
              id="apps-filter-company"
              value={companyId}
              onChange={(value) => filter(() => setCompanyId(value))}
              emptyLabel={t("custom_apps:apps.filters.any_company")}
            />
          </WithHelp>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                filter(() => {
                  setSearch("");
                  setState("");
                  setKind("");
                  setCompanyId("");
                })
              }
            >
              {t("admin:common.clear_filters")}
            </Button>
          )}
        </div>

        <PanelState
          loading={apps.loading && !apps.data}
          error={apps.error}
          forbidden={apps.status === 403}
          onRetry={apps.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            filtered ? (
              <p className="py-4 text-sm text-neutral-500">{t("custom_apps:apps.no_matches")}</p>
            ) : (
              <EmptyState
                icon={<AppWindow size={28} />}
                title={t("custom_apps:apps.empty_title")}
                description={t("custom_apps:apps.empty_description")}
                action={
                  <Button asChild>
                    <Link to={customAppsRoute.appNew()}>
                      <Plus size={16} /> {t("custom_apps:apps.new")}
                    </Link>
                  </Button>
                }
              />
            )
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(customAppsRoute.app(row.id))}
              caption={t("custom_apps:apps.title")}
              className={apps.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={total}
            onChange={setOffset}
            disabled={apps.loading}
          />
        </PanelState>
      </Panel>
    </>
  );
};
