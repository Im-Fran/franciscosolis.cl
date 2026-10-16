import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {Tray, Sliders} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {cn} from "@/lib/utils.ts";

/** The alert section's two screens: what fired, and what is being watched for. */
export const AlertsTabs = () => {
  const {t} = useTranslation("custom_apps");
  const items = [
    {to: customAppsRoute.alerts(), label: t("alerts.tabs.inbox"), icon: Tray, end: true},
    {to: customAppsRoute.alertRules, label: t("alerts.tabs.rules"), icon: Sliders, end: false},
  ];

  return (
    <nav aria-label={t("alerts.tabs.label")} className="mb-6 flex flex-wrap gap-1">
      {items.map(({to, label, icon: Icon, end}) => (
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
        </NavLink>
      ))}
    </nav>
  );
};
