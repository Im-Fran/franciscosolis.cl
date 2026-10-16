import {AppWindow, Buildings, ClockCounterClockwise, Gauge, AddressBook} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {CUSTOM_APPS_ROUTE, customAppsRoute} from "@/lib/custom-apps/config.ts";

export type NavItem = {
  to: string;
  /** Key in the `custom_apps` namespace. */
  label: string;
  icon: Icon;
  /** Marks the item active for any deeper route, not just an exact match. */
  nested?: boolean;
  /**
   * Other path prefixes that belong to this section. An installation is addressed on its own
   * (`/installations/:id`) but is part of an app, and the menu going blank on one would read as
   * having left the panel.
   */
  also?: string[];
};

/**
 * The panel's map. The CRM comes before the apps because that is the order they are created in:
 * a company, the people there, then what was built for it.
 */
export const NAV_ITEMS: NavItem[] = [
  {to: customAppsRoute.home, label: "shell.overview", icon: Gauge},
  {to: customAppsRoute.companies, label: "shell.companies", icon: Buildings, nested: true},
  {to: customAppsRoute.contacts, label: "shell.contacts", icon: AddressBook, nested: true},
  {
    to: customAppsRoute.apps,
    label: "shell.apps",
    icon: AppWindow,
    nested: true,
    also: [`${CUSTOM_APPS_ROUTE}/installations/`],
  },
  {to: customAppsRoute.audit, label: "shell.audit", icon: ClockCounterClockwise},
];
