import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import type {AppSummary} from "@/lib/custom-apps/types.ts";
import {StateBadge} from "@/pages/custom-apps/components/badges.tsx";

/** One app as a line in a short list — a company's apps — with what is connected right now. */
export const AppRow = ({app}: {app: AppSummary}) => {
  const {t} = useTranslation("custom_apps");

  return (
    <li>
      <Link
        to={customAppsRoute.app(app.id)}
        className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{app.name}</span>
          <span className="block truncate text-[12px] text-neutral-500">
            {t(`kinds.${app.kind}`, {defaultValue: app.kind})} ·{" "}
            {t("apps.connected_of", {connected: app.connected_count, total: app.installation_count})}
          </span>
        </span>
        <StateBadge state={app.state} />
        <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true" />
      </Link>
    </li>
  );
};
