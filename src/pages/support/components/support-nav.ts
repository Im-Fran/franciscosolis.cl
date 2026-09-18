import {
  Books,
  ClockCounterClockwise,
  EnvelopeSimple,
  FolderSimple,
  Tag,
  Tray,
  TrayArrowDown,
} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {supportRoute} from "@/lib/support/config.ts";

export type NavItem = {
  to: string;
  /** Key in the `support_agent` namespace. */
  label: string;
  icon: Icon;
  /** Marks the item active for any deeper route, not just an exact match. */
  nested?: boolean;
  /** Only drawn for an account holding `support:admin`. */
  administrative?: boolean;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

/**
 * The console's map.
 *
 * `administrative` filters the menu, not the access: every one of those routes checks the permission
 * for itself, and the API checks it again. Hiding them is only so the menu does not offer an agent
 * four entries that all answer 403 — which is a worse experience than a shorter menu, not a security
 * measure.
 */
export const buildNav = (canAdminister: boolean): NavSection[] => {
  const sections: NavSection[] = [
    {
      items: [
        {to: supportRoute.inbox, label: "nav.inbox", icon: Tray},
        {to: `${supportRoute.inbox}?unassigned=true`, label: "nav.unassigned", icon: TrayArrowDown},
      ],
    },
    {
      title: "nav.knowledge",
      items: [
        {to: supportRoute.articles, label: "nav.articles", icon: Books, nested: true, administrative: true},
        {to: supportRoute.categories, label: "nav.categories", icon: FolderSimple, administrative: true},
        {to: supportRoute.labels, label: "nav.labels", icon: Tag, administrative: true},
      ],
    },
    {
      title: "nav.operations",
      items: [
        {to: supportRoute.emails, label: "nav.emails", icon: EnvelopeSimple},
        {to: supportRoute.audit, label: "nav.audit", icon: ClockCounterClockwise},
      ],
    },
  ];

  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAdminister || !item.administrative),
  }));
};
