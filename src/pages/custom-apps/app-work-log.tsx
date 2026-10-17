import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {AppContractCard} from "@/pages/custom-apps/components/contracts/app-contract-card.tsx";
import {WorkLogPanel} from "@/pages/custom-apps/components/work-log/work-log-panel.tsx";
import type {WorkLogScope} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";

/**
 * The app's work log (bitácora) tab: the work done on this app, newest first, and the contract it is
 * filed under. Not a module — work is logged whatever the app itself reports — so the tab is always
 * there.
 */
export const AppWorkLog = () => {
  const {t} = useTranslation("custom_apps");
  const {app} = useApp();
  const scope = useMemo<WorkLogScope>(() => ({kind: "app", appId: app.id, companyId: app.company_id}), [app.id, app.company_id]);

  return (
    <div className="flex flex-col gap-6">
      <AppContractCard appId={app.id} companyId={app.company_id} />
      <WorkLogPanel scope={scope} description={t("work_log.description_app")} />
    </div>
  );
};
