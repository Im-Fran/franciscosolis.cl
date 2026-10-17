import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight, FileText, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatMoney} from "@/lib/custom-apps/format.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {ContractStatusBadge, ExpiringBadge} from "@/pages/custom-apps/components/badges.tsx";
import {contractPeriod} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {UsageBar} from "@/pages/custom-apps/components/contracts/usage-bar.tsx";

/** A client's contracts, ending soonest first, with a button to add one already pointed at the client. */
export const CompanyContractsPanel = ({companyId}: {companyId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const contracts = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.contracts.list({company_id: companyId, limit: 100}, signal), [companyId]),
  );
  const rows = contracts.data?.data ?? [];

  return (
    <Panel
      title={t("custom_apps:companies.contracts_title")}
      description={t("custom_apps:companies.contracts_description")}
      action={
        <Button variant="secondary" size="sm" asChild>
          <Link to={customAppsRoute.contractNew(companyId)}>
            <Plus size={14} /> {t("custom_apps:contracts.new")}
          </Link>
        </Button>
      }
    >
      <PanelState loading={contracts.loading && !contracts.data} error={contracts.error} onRetry={contracts.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={<FileText size={28} />} title={t("custom_apps:companies.contracts_empty")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((contract) => (
              <li key={contract.id}>
                <Link
                  to={customAppsRoute.contract(contract.id)}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm text-text">
                      {contract.name}
                      <ContractStatusBadge value={contract.status} />
                      {contract.expiring && <ExpiringBadge daysLeft={contract.days_left} />}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-neutral-500">
                      {contractPeriod(contract, t, language)} · {formatMoney(contract.amount, contract.currency, language)}{" "}
                      {t(`custom_apps:billing_periods.${contract.billing_period}`, {defaultValue: contract.billing_period})}
                      {contract.apps.length > 0 && ` · ${contract.apps.map((app) => app.name).join(", ")}`}
                    </span>
                  </span>
                  {contract.current_cycle && <UsageBar cycle={contract.current_cycle} compact className="w-full sm:w-56" />}
                  <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelState>
    </Panel>
  );
};
