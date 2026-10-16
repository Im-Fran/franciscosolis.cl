import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {InstallationSummary} from "@/lib/custom-apps/types.ts";
import {ConnectedIndicator, LifecycleBadge, ReviewBadge} from "@/pages/custom-apps/components/badges.tsx";
import {describePlatform, installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

/**
 * One installation as a line in a short list — the overview's two lists, where a table would be
 * more furniture than ten rows deserve. The whole line is the link.
 */
export const InstallationRow = ({installation, when}: {installation: InstallationSummary; when: "enrolled" | "seen"}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const moment = when === "enrolled" ? installation.enrolled_at : installation.last_seen_at;
  const platform = describePlatform(installation);

  return (
    <li>
      <Link
        to={customAppsRoute.installation(installation.id)}
        className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
      >
        <ConnectedIndicator connected={installation.connected} compact />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{installationLabel(installation)}</span>
          <span className="block truncate text-[12px] text-neutral-500">
            {[installation.app?.name, t(`platforms.${installation.platform}`, {defaultValue: installation.platform}), platform]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {installation.status === "revoked" ? (
          <LifecycleBadge status="revoked" />
        ) : installation.needs_review ? (
          <ReviewBadge />
        ) : null}
        <span className="hidden shrink-0 text-[12px] text-neutral-500 sm:block">
          {moment
            ? t(when === "enrolled" ? "installations.enrolled_ago" : "installations.seen_ago", {
                when: formatLastSeen(moment, i18n.language),
              })
            : t("installations.never_seen")}
        </span>
        <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true" />
      </Link>
    </li>
  );
};
