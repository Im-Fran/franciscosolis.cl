import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Alert} from "@/components/ui/alert.tsx";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import type {AppModule} from "@/lib/custom-apps/types.ts";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";

/**
 * Renders a module's tab only while the app has that module on, and says how to turn it on
 * otherwise. The tab bar already hides these tabs; this is for a link kept from before the module
 * was turned off, which should explain itself rather than show a screen the service would refuse.
 *
 * With several `modules`, any one of them is enough — the crashes-and-logs tab is useful with
 * either.
 */
export const ModuleGate = ({modules, children}: {modules: AppModule[]; children: ReactNode}) => {
  const {t} = useTranslation("custom_apps");
  const {app} = useApp();

  if (modules.some((module) => (app.modules ?? []).includes(module))) return <>{children}</>;

  return (
    <Alert
      tone="info"
      title={t("module_off.title", {
        modules: modules.map((module) => t(`modules.${module}`, {defaultValue: module})).join(" / "),
      })}
    >
      {t("module_off.body")}{" "}
      <Link to={customAppsRoute.appSettings(app.id)} className="underline">
        {t("module_off.link")}
      </Link>
    </Alert>
  );
};
