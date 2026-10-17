import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Bell} from "@phosphor-icons/react";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";

const REFRESH_MS = 60_000;

/**
 * "2 open alerts", linking to the inbox filtered to this app or this device — or nothing at all.
 *
 * It asks for one row and reads the total, so it costs one small read a minute. A failure renders
 * nothing: this is a hint beside a screen about something else, and an error box in its place would
 * be louder than the alerts it failed to count.
 */
export const OpenAlertsHint = ({appId, installationId}: {appId?: string; installationId?: string}) => {
  const {t} = useTranslation("custom_apps");
  const alerts = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.alerts.list({status: "unresolved", app_id: appId, installation_id: installationId, limit: 1}, signal),
      [appId, installationId],
    ),
  );
  useAutoRefresh(alerts.reload, REFRESH_MS);

  const count = alerts.data?.pagination.total ?? 0;
  if (count === 0) return null;

  return (
    <Link
      to={customAppsRoute.alerts({app_id: appId, installation_id: installationId, status: "unresolved"})}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 transition-colors hover:border-red-500/60"
    >
      <Bell size={18} weight="fill" className="shrink-0" aria-hidden="true" />
      <span className="flex-1">{t("alerts.open_hint", {count})}</span>
      <span className="text-[13px] underline">{t("alerts.open_hint_link")}</span>
    </Link>
  );
};
