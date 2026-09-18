import {
  ClockCounterClockwise,
  EnvelopeSimple,
  Gauge,
  PaperPlaneTilt,
  Scales,
  SquaresFour,
  Stack,
} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {cmsRoute} from "@/lib/cms/config.ts";
import {pagesRoute} from "@/lib/pages/config.ts";
import type {CmsCollection} from "@/lib/cms/types.ts";

export type NavItem = {
  to: string;
  /** Key in the `cms` namespace, or a literal label for the collections the service names. */
  label: string;
  literal?: boolean;
  icon: Icon;
  /** Marks the item active for any deeper route, not just an exact match. */
  nested?: boolean;
};

export type NavSection = {
  /** Key in the `cms` namespace; omitted for the first, unlabelled group. */
  title?: string;
  items: NavItem[];
};

/**
 * The interface's own map. Built from the collections the service reports rather than a hard-coded
 * list, so a collection added on the API shows up here without a release.
 */
export const buildNav = (collections: CmsCollection[]): NavSection[] => [
  {
    items: [{to: cmsRoute.overview, label: "nav.overview", icon: Gauge}],
  },
  {
    title: "nav.content",
    items: collections.map((collection) => ({
      to: cmsRoute.content(collection.slug),
      label: collection.name,
      literal: true,
      icon: Stack,
      nested: true,
    })),
  },
  {
    title: "nav.site",
    items: [
      {to: cmsRoute.legal, label: "nav.legal", icon: Scales, nested: true},
      /* A different service behind the same session — see `pages/cms/cms-routes.tsx`. */
      {to: pagesRoute.list, label: "nav.pages", icon: SquaresFour, nested: true},
    ],
  },
  {
    title: "nav.email",
    items: [
      {to: cmsRoute.templates, label: "nav.templates", icon: EnvelopeSimple, nested: true},
      {to: cmsRoute.emails, label: "nav.messages", icon: PaperPlaneTilt, nested: true},
    ],
  },
  {
    title: "nav.activity",
    items: [{to: cmsRoute.audit, label: "nav.audit", icon: ClockCounterClockwise}],
  },
];
