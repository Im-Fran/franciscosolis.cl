import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight, FileText, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import type {Contract} from "@/lib/custom-apps/types.ts";
import {ContractStatusBadge, ExpiringBadge} from "@/pages/custom-apps/components/badges.tsx";
import {contractPeriod} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {UsageBar} from "@/pages/custom-apps/components/contracts/usage-bar.tsx";

/**
 * Which contract the panel would call "the" contract of an app: the one running (or in grace) today,
 * then one about to start, then the most recent that ended. An app is never covered by two contracts
 * in the same dates — the service refuses that — so "running today" is at most one.
 */
const RANK: Record<string, number> = {active: 0, grace: 1, scheduled: 2, ended: 3, cancelled: 4};
const pick = (rows: Contract[]) => [...rows].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9))[0] ?? null;

/**
 * The contract covering an app, as a short card above the app's summary and its work log: status,
 * dates and how much of the current cycle's hours are used. A failure renders nothing — this sits
 * beside a screen about something else.
 */
export const AppContractCard = ({appId, companyId}: {appId: string; companyId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const contracts = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.contracts.list({app_id: appId, limit: 50}, signal), [appId]),
  );

  if (contracts.loading && !contracts.data) return null;
  if (contracts.error) return null;

  const contract = pick(contracts.data?.data ?? []);

  if (!contract) {
    return (
      <Panel
        title={t("custom_apps:app_contract.title")}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to={customAppsRoute.contractNew(companyId)}>
              <Plus size={14} /> {t("custom_apps:contracts.new")}
            </Link>
          </Button>
        }
      >
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <FileText size={16} aria-hidden="true" /> {t("custom_apps:app_contract.none")}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={t("custom_apps:app_contract.title")}>
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
          <span className="mt-0.5 block text-[12px] text-neutral-500">{contractPeriod(contract, t, i18n.language)}</span>
        </span>
        {contract.current_cycle && <UsageBar cycle={contract.current_cycle} compact className="w-full sm:w-56" />}
        <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true" />
      </Link>
    </Panel>
  );
};
