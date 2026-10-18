import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useSearchParams} from "react-router-dom";
import {ArrowClockwise, FileText, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatMoney} from "@/lib/custom-apps/format.ts";
import type {Contract, ContractStatus} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {CompanySelect} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {ContractStatusBadge, ExpiringBadge} from "@/pages/custom-apps/components/badges.tsx";
import {companyName, contractPeriod} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {UsageBar} from "@/pages/custom-apps/components/contracts/usage-bar.tsx";

const PAGE_SIZE = 50;

/**
 * Every contract, ending soonest first and open-ended last — the order the service sorts in, which is
 * the order they need attention in. The filters are the service's, so they reach the whole list.
 *
 * The status filter and the client are kept in the address, so the overview's "expiring" and "in
 * grace" cards can link straight to a filtered list.
 */
export const ContractList = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const navigate = useNavigate();
  const vocabulary = useServiceVocabulary();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const companyId = params.get("company_id") ?? "";
  const [offset, setOffset] = useState(0);

  const contracts = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.contracts.list(
          {status: (status || undefined) as ContractStatus | undefined, company_id: companyId || undefined, limit: PAGE_SIZE, offset},
          signal,
        ),
      [status, companyId, offset],
    ),
  );

  const rows = contracts.data?.data ?? [];
  const total = contracts.data?.pagination.total ?? 0;
  const filtered = Boolean(status || companyId);

  const setFilter = (key: "status" | "company_id", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, {replace: true});
    setOffset(0);
  };

  const columns = useMemo<Column<Contract>[]>(
    () => [
      {
        key: "name",
        header: t("custom_apps:contracts.columns.name"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{row.name}</p>
            <p className="truncate text-[12px] text-neutral-500">{companyName(row.company) ?? ""}</p>
          </div>
        ),
      },
      {
        key: "apps",
        header: t("custom_apps:contracts.columns.apps"),
        className: "w-40",
        hideBelowLg: true,
        cell: (row) =>
          row.apps.length === 0 ? (
            <span className="text-neutral-600">{t("custom_apps:contracts.no_apps")}</span>
          ) : (
            <span className="line-clamp-2 text-[12px] text-neutral-400" title={row.apps.map((app) => app.name).join(", ")}>
              {row.apps.map((app) => app.name).join(", ")}
            </span>
          ),
      },
      {
        key: "status",
        header: t("custom_apps:contracts.columns.status"),
        className: "w-40",
        cell: (row) => (
          <span className="flex flex-col items-start gap-1">
            <ContractStatusBadge value={row.status} />
            {row.expiring && <ExpiringBadge daysLeft={row.days_left} />}
            {!row.expiring && row.status === "active" && row.days_left !== null && (
              <span className="text-[12px] text-neutral-500">{t("custom_apps:contracts.days_left", {count: row.days_left})}</span>
            )}
          </span>
        ),
      },
      {
        key: "period",
        header: t("custom_apps:contracts.columns.period"),
        className: "w-56",
        hideBelowLg: true,
        cell: (row) => (
          <span className="flex flex-col text-[12px]">
            <span className="text-neutral-300">{contractPeriod(row, t, language)}</span>
            {row.auto_renew && <span className="text-neutral-500">{t("custom_apps:contracts.auto_renews", {count: row.renewal_months})}</span>}
          </span>
        ),
      },
      {
        key: "usage",
        header: t("custom_apps:contracts.columns.usage"),
        className: "w-48",
        cell: (row) =>
          row.current_cycle ? <UsageBar cycle={row.current_cycle} compact /> : <span className="text-[12px] text-neutral-600">{t("custom_apps:contracts.no_cycle")}</span>,
      },
      {
        key: "amount",
        header: t("custom_apps:contracts.columns.amount"),
        className: "w-36 text-right",
        cell: (row) => (
          <span className="flex flex-col items-end tabular-nums">
            <span className="text-text">{formatMoney(row.amount, row.currency, language)}</span>
            <span className="text-[12px] text-neutral-500">{t(`custom_apps:billing_periods.${row.billing_period}`, {defaultValue: row.billing_period})}</span>
          </span>
        ),
      },
    ],
    [language, t],
  );

  return (
    <>
      <PageHeader
        title={t("custom_apps:contracts.title")}
        description={t("custom_apps:contracts.description")}
        actions={
          <Button asChild>
            <Link to={customAppsRoute.contractNew(companyId || undefined)}>
              <Plus size={16} /> {t("custom_apps:contracts.new")}
            </Link>
          </Button>
        }
      />

      <Panel
        title={t("custom_apps:contracts.panel_title")}
        description={contracts.data ? t("custom_apps:contracts.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={contracts.reload}>
            <ArrowClockwise size={14} /> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Select
            value={status}
            onChange={(event) => setFilter("status", event.target.value)}
            aria-label={t("custom_apps:contracts.filters.status")}
            className="w-auto min-w-[10rem]"
          >
            <option value="">{t("custom_apps:contracts.filters.any_status")}</option>
            {vocabulary.contractStatuses.map((value) => (
              <option key={value} value={value}>
                {t(`custom_apps:contract_statuses.${value}`, {defaultValue: value})}
              </option>
            ))}
          </Select>
          <div className="w-full sm:w-64">
            <CompanySelect
              id="contracts-filter-company"
              value={companyId}
              onChange={(value) => setFilter("company_id", value)}
              emptyLabel={t("custom_apps:contracts.filters.any_company")}
            />
          </div>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParams(new URLSearchParams(), {replace: true});
                setOffset(0);
              }}
            >
              {t("admin:common.clear_filters")}
            </Button>
          )}
        </div>

        <PanelState
          loading={contracts.loading && !contracts.data}
          error={contracts.error}
          forbidden={contracts.status === 403}
          onRetry={contracts.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            filtered ? (
              <p className="py-4 text-sm text-neutral-500">{t("custom_apps:contracts.no_matches")}</p>
            ) : (
              <EmptyState
                icon={<FileText size={28} />}
                title={t("custom_apps:contracts.empty_title")}
                description={t("custom_apps:contracts.empty_description")}
                action={
                  <Button asChild>
                    <Link to={customAppsRoute.contractNew()}>
                      <Plus size={16} /> {t("custom_apps:contracts.new")}
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
              onRowClick={(row) => navigate(customAppsRoute.contract(row.id))}
              caption={t("custom_apps:contracts.title")}
              className={contracts.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}

          <Pagination offset={offset} limit={PAGE_SIZE} count={rows.length} total={total} onChange={setOffset} disabled={contracts.loading} />
        </PanelState>
      </Panel>
    </>
  );
};
