import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Lifebuoy} from "@phosphor-icons/react";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";

const REFRESH_MS = 60_000;

/**
 * "2 tickets are waiting for an answer", linking to the inbox filtered to this app — or nothing at
 * all. Like the open-alerts hint beside it, it asks for one row and reads the total, and a failure
 * renders nothing: it is a hint beside a screen about something else.
 */
export const OpenTicketsHint = ({appId}: {appId: string}) => {
  const {t} = useTranslation("custom_apps");
  const tickets = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.tickets.list({status: "open", app_id: appId, limit: 1}, signal), [appId]),
  );
  useAutoRefresh(tickets.reload, REFRESH_MS);

  const count = tickets.data?.pagination.total ?? 0;
  if (count === 0) return null;

  return (
    <Link
      to={customAppsRoute.tickets({app_id: appId, status: "open"})}
      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 transition-colors hover:border-amber-500/60"
    >
      <Lifebuoy size={18} weight="fill" className="shrink-0" aria-hidden="true" />
      <span className="flex-1">{t("tickets.hint", {count})}</span>
      <span className="text-[13px] underline">{t("tickets.hint_link")}</span>
    </Link>
  );
};
