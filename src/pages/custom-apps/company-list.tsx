import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {ArrowClockwise, Buildings, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatRut} from "@/lib/custom-apps/rut.ts";
import type {Company} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const PAGE_SIZE = 50;

/**
 * The clients: companies and the natural persons apps were built for, in one list, because the
 * service keeps them in one table and the only difference that matters here is a toggle.
 *
 * The search runs on the service — it matches the legal name, the trade name and the RUT — so it
 * reaches the whole list rather than the page that happens to be loaded.
 */
export const CompanyList = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced] = useDebounceValue(search.trim(), 300);
  const [offset, setOffset] = useState(0);

  const companies = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.companies.list({search: debounced, limit: PAGE_SIZE, offset}, signal),
      [debounced, offset],
    ),
  );

  const rows = companies.data?.data ?? [];
  const total = companies.data?.pagination.total ?? 0;

  const columns = useMemo<Column<Company>[]>(
    () => [
      {
        key: "name",
        header: t("custom_apps:companies.columns.name"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{row.legal_name}</p>
            {row.trade_name && <p className="truncate text-[12px] text-neutral-500">{row.trade_name}</p>}
          </div>
        ),
      },
      {
        key: "rut",
        header: t("custom_apps:companies.columns.rut"),
        className: "w-36",
        cell: (row) =>
          row.rut ? (
            <span className="font-mono text-[13px]">{formatRut(row.rut)}</span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
      },
      {
        key: "kind",
        header: t("custom_apps:companies.columns.kind"),
        className: "w-36",
        hideBelowLg: true,
        cell: (row) => (row.is_company ? t("custom_apps:companies.company") : t("custom_apps:companies.person")),
      },
      {
        key: "apps",
        header: t("custom_apps:companies.columns.apps"),
        className: "w-20 tabular-nums",
        cell: (row) => row.app_count,
      },
      {
        key: "contacts",
        header: t("custom_apps:companies.columns.contacts"),
        className: "w-24 tabular-nums",
        hideBelowLg: true,
        cell: (row) => row.contact_count,
      },
      {
        key: "updated",
        header: t("custom_apps:companies.columns.updated"),
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
        title={t("custom_apps:companies.title")}
        description={t("custom_apps:companies.description")}
        actions={
          <Button asChild>
            <Link to={customAppsRoute.companyNew}>
              <Plus size={16} /> {t("custom_apps:companies.new")}
            </Link>
          </Button>
        }
      />

      <Panel
        title={t("custom_apps:companies.panel_title")}
        description={companies.data ? t("custom_apps:companies.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={companies.reload}>
            <ArrowClockwise size={14} /> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5 flex">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setOffset(0);
            }}
            placeholder={t("custom_apps:companies.search")}
            help={help.field("companies.filter_help.search")}
          />
        </div>

        <PanelState
          loading={companies.loading && !companies.data}
          error={companies.error}
          forbidden={companies.status === 403}
          onRetry={companies.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            debounced ? (
              <p className="py-4 text-sm text-neutral-500">{t("custom_apps:no_matches", {search: debounced})}</p>
            ) : (
              <EmptyState
                icon={<Buildings size={28} />}
                title={t("custom_apps:companies.empty_title")}
                description={t("custom_apps:companies.empty_description")}
                action={
                  <Button asChild>
                    <Link to={customAppsRoute.companyNew}>
                      <Plus size={16} /> {t("custom_apps:companies.new")}
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
              onRowClick={(row) => navigate(customAppsRoute.company(row.id))}
              caption={t("custom_apps:companies.title")}
              className={companies.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={total}
            onChange={setOffset}
            disabled={companies.loading}
          />
        </PanelState>
      </Panel>
    </>
  );
};
