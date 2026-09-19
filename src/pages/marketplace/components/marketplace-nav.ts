import {Storefront} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";

export type NavItem = {
  to: string;
  /** Key in the `marketplace_admin` namespace. */
  label: string;
  icon: Icon;
  /** Marks the item active for any deeper route, not just an exact match. */
  nested?: boolean;
};

/**
 * The console's map, and it is deliberately one entry long.
 *
 * Everything in this console hangs off a product — its releases, its wiki, its sales, its
 * receipts — so the top level is the product list and nothing else. `ProductNav` is what draws the
 * sections *inside* one product, and repeating them here would be a second menu describing the same
 * tree from one level further away, with two places to forget a section.
 *
 * It stays a list rather than collapsing into a single link because the console will grow entries
 * that are not about one product: the cross-product review queue is the next one.
 */
export const NAV_ITEMS: NavItem[] = [
  {to: marketplaceRoute.list, label: "shell.products", icon: Storefront, nested: true},
];
