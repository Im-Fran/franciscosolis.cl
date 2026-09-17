import {DeviceMobile, IdentificationCard, ShieldCheck, SignIn, UserCircle} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {accountRoute} from "@/lib/auth/config.ts";

export type AccountSection = {
  /** Matches the tab's route, and is what Radix keeps the selection on. */
  value: keyof typeof accountRoute;
  to: string;
  label: string;
  icon: Icon;
};

/**
 * The account's sections, in the order they are read: who you are, then what that grants you, then
 * what is currently using it.
 *
 * One list feeds both the tabs and the routes, so a section cannot exist in the navigation and be
 * missing from the router.
 */
export const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  {value: "profile", to: accountRoute.profile, label: "auth:account.tabs.profile", icon: UserCircle},
  {value: "access", to: accountRoute.access, label: "auth:account.tabs.access", icon: ShieldCheck},
  {value: "identities", to: accountRoute.identities, label: "auth:account.tabs.identities", icon: SignIn},
  {value: "sessions", to: accountRoute.sessions, label: "auth:account.tabs.sessions", icon: DeviceMobile},
  {value: "details", to: accountRoute.details, label: "auth:account.tabs.details", icon: IdentificationCard},
];

/** Which tab a pathname is inside. An unknown path keeps the first tab lit rather than none. */
export const sectionFromPath = (pathname: string): AccountSection["value"] => {
  const match = ACCOUNT_SECTIONS.find(
    (section) => section.to !== accountRoute.profile && pathname.startsWith(section.to),
  );
  return match?.value ?? "profile";
};
