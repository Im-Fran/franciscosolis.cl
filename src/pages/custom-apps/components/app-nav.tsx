import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {
  Bug,
  ChartBar,
  ChatCenteredText,
  Devices,
  GearSix,
  Notebook,
  Package,
  Power,
  SlidersHorizontal,
  SquaresFour,
} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import type {AppModule} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";

/**
 * Moving between the tabs of one app. Each one is a route, like a marketplace product's sections,
 * so "the installations of that app" is a link somebody can send.
 *
 * The remote-operation tabs follow the app's modules: an app that does not report crashes has no
 * crash list to show, and a tab that only ever says "this module is off" is a tab too many. Their
 * routes still answer — a link kept from before a module was turned off says so instead of 404-ing.
 */
export const AppNav = ({id, needsReview, modules}: {id: string; needsReview: number; modules: AppModule[]}) => {
  const {t} = useTranslation("custom_apps");
  const has = (module: AppModule) => modules.includes(module);

  const items = [
    {to: customAppsRoute.app(id), label: t("app_nav.summary"), icon: SquaresFour, end: true, badge: 0, shown: true},
    {
      to: customAppsRoute.appInstallations(id),
      label: t("app_nav.installations"),
      icon: Devices,
      end: false,
      badge: needsReview,
      shown: true,
    },
    {to: customAppsRoute.appUsage(id), label: t("app_nav.usage"), icon: ChartBar, end: false, badge: 0, shown: true},
    {
      to: customAppsRoute.appConfig(id),
      label: t("app_nav.config"),
      icon: SlidersHorizontal,
      end: false,
      badge: 0,
      shown: has("config"),
    },
    {
      to: customAppsRoute.appMessages(id),
      label: t("app_nav.messages"),
      icon: ChatCenteredText,
      end: false,
      badge: 0,
      shown: has("messages"),
    },
    {
      to: customAppsRoute.appDiagnostics(id),
      label: t("app_nav.diagnostics"),
      icon: Bug,
      end: false,
      badge: 0,
      shown: has("crashes") || has("logs"),
    },
    {
      to: customAppsRoute.appReleases(id),
      label: t("app_nav.releases"),
      icon: Package,
      end: false,
      badge: 0,
      shown: has("updates"),
    },
    /* Not a module: work is logged on an app whatever the app itself reports. */
    {to: customAppsRoute.appWorkLog(id), label: t("app_nav.work_log"), icon: Notebook, end: false, badge: 0, shown: true},
    {to: customAppsRoute.appStatus(id), label: t("app_nav.status"), icon: Power, end: false, badge: 0, shown: true},
    {to: customAppsRoute.appSettings(id), label: t("app_nav.settings"), icon: GearSix, end: false, badge: 0, shown: true},
  ].filter((item) => item.shown);

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
