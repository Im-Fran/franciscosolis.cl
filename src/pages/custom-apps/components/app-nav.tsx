import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {ChartBar, Devices, GearSix, Power, SquaresFour} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {cn} from "@/lib/utils.ts";

/**
 * Moving between the tabs of one app. Each one is a route, like a marketplace product's sections,
 * so "the installations of that app" is a link somebody can send.
 */
export const AppNav = ({id, needsReview}: {id: string; needsReview: number}) => {
  const {t} = useTranslation("custom_apps");

  const items = [
    {to: customAppsRoute.app(id), label: t("app_nav.summary"), icon: SquaresFour, end: true, badge: 0},
    {to: customAppsRoute.appInstallations(id), label: t("app_nav.installations"), icon: Devices, end: false, badge: needsReview},
    {to: customAppsRoute.appUsage(id), label: t("app_nav.usage"), icon: ChartBar, end: false, badge: 0},
    {to: customAppsRoute.appStatus(id), label: t("app_nav.status"), icon: Power, end: false, badge: 0},
    {to: customAppsRoute.appSettings(id), label: t("app_nav.settings"), icon: GearSix, end: false, badge: 0},
  ];

  return (
    <nav aria-label={t("app_nav.label")} className="mb-6 flex flex-wrap gap-1">
      {items.map(({to, label, icon: Icon, end, badge}) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({isActive}) =>
            cn(
              "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors",
              isActive ? "bg-accent-900/50 text-accent-200" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
            )
          }
        >
          <Icon size={16} /> {label}
          {/* Waiting for a look is the one count worth carrying into the tab bar. */}
          {badge > 0 && (
            <span
              className="rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-300 tabular-nums"
              aria-label={t("app_nav.needs_review_aria", {count: badge})}
            >
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
};
