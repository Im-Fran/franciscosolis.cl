import {
  AppWindow,
  ClockCounterClockwise,
  EnvelopeSimple,
  Gauge,
  Key,
  Monitor,
  ShieldCheck,
  Users,
} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {adminRoute} from "@/lib/auth/config.ts";

export type NavItem = {
  to: string;
  /** Key in the `auth_admin` namespace. */
  label: string;
  icon: Icon;
  /** Marks the item active for any deeper route, not just an exact match. */
  nested?: boolean;
  /**
   * Permission the section's own list endpoint checks. The item is hidden without it — not as a
   * security measure, since the API is the authority either way, but because a menu of entries
   * that all answer 403 is worse than a shorter menu.
   */
  permission?: string;
};

export type NavSection = {
  /** Key in the `auth_admin` namespace; omitted for the first, unlabelled group. */
  title?: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    items: [{to: adminRoute.overview, label: "nav.overview", icon: Gauge}],
  },
  {
    title: "nav.people",
    items: [
      {to: adminRoute.users, label: "nav.users", icon: Users, nested: true, permission: "users:read"},
      {
        to: adminRoute.invitations,
        label: "nav.invitations",
        icon: EnvelopeSimple,
        nested: true,
        permission: "invitations:read",
      },
      {to: adminRoute.sessions, label: "nav.sessions", icon: Monitor, permission: "sessions:read"},
    ],
  },
  {
    title: "nav.access",
    items: [
      {
        to: adminRoute.applications,
        label: "nav.applications",
        icon: AppWindow,
        nested: true,
        permission: "applications:read",
      },
      {to: adminRoute.roles, label: "nav.roles", icon: ShieldCheck, nested: true, permission: "roles:read"},
      {to: adminRoute.permissions, label: "nav.permissions", icon: Key, permission: "roles:read"},
    ],
  },
  {
    title: "nav.activity",
    items: [{to: adminRoute.audit, label: "nav.audit", icon: ClockCounterClockwise, permission: "audit:read"}],
  },
];

/** The sections this account can actually use, with the empty groups dropped. */
export const buildNav = (can: (permission: string) => boolean): NavSection[] =>
  SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((section) => section.items.length > 0);
