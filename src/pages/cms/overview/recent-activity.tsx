import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import type {OverviewData} from "@/pages/cms/overview/use-overview-data.ts";
import {SkeletonRows} from "@/pages/cms/overview/skeleton-rows.tsx";

export type RecentActivityProps = Pick<OverviewData, "activity"> & {className?: string};

/**
 * The last few things that happened, as the service recorded them.
 *
 * The event is printed exactly as the API names it. The audit screen is where those names get
 * translated into sentences; repeating that vocabulary here would mean two places to keep in step
 * with the service, and one of them would eventually be wrong.
 */
export const RecentActivity = ({activity, className}: RecentActivityProps) => {
  const {t, i18n} = useTranslation(["cms_overview", "cms"]);

  return (
    <Panel
      className={className}
      title={t("cms_overview:activity.title")}
      description={t("cms_overview:activity.description")}
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to={cmsRoute.audit}>
            {t("cms_overview:activity.see_all")} <ArrowRight size={14}/>
          </Link>
        </Button>
      }
    >
      {activity.loading ? (
        <SkeletonRows rows={4}/>
      ) : (
        <PanelState
          ns="cms"
          loading={false}
          error={activity.error}
          forbidden={activity.status === 403}
          empty={activity.data?.length === 0}
          emptyLabel={t("cms_overview:activity.empty")}
          onRetry={activity.reload}
        >
          <ul className="flex flex-col">
            {activity.data?.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-800/70 py-2.5 last:border-0"
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <code className="font-mono text-[13px] break-all text-neutral-300">{entry.event}</code>
                  {entry.actor_email && (
                    <span className="truncate text-[13px] text-neutral-600">{entry.actor_email}</span>
                  )}
                </div>
                <time dateTime={entry.created_at} className="shrink-0 text-xs text-neutral-600">
                  {formatDateTime(entry.created_at, i18n.language)}
                </time>
              </li>
            ))}
          </ul>
        </PanelState>
      )}
    </Panel>
  );
};
