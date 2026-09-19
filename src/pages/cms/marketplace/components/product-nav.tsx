import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {BookOpen, CurrencyDollar, Note, Receipt, SquaresFour} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";

/**
 * Moving between the sections of one product, once it exists.
 *
 * The first three mirror the tab bar a visitor sees, deliberately: an editor who knows the page
 * knows this navigation. Releases and Wiki are shown whether or not the product turned those
 * tabs on — writing the content is what usually comes *before* turning the tab on, and hiding the
 * editor until the tab is enabled would make that order impossible.
 *
 * Sales and Receipts are the exception and are **not** tabs on the product page. There is no fifth
 * public tab and there must not be: the page's shape is a house standard enforced by a registry in
 * the service (`apps/pages/src/lib/tabs.ts`), and a visitor has no business reading the takings.
 * They are shown for every product, including the free ones, because "did anybody donate" is a
 * question about a free product too — and because a product's mode changes.
 */
export const ProductNav = ({id}: {id: string}) => {
  const {t} = useTranslation(["cms_marketplace"]);

  const items = [
    {to: marketplaceRoute.item(id), label: t("cms_marketplace:nav.page"), icon: SquaresFour, end: true},
    {to: marketplaceRoute.releases(id), label: t("cms_marketplace:nav.releases"), icon: Note, end: false},
    {to: marketplaceRoute.wiki(id), label: t("cms_marketplace:nav.wiki"), icon: BookOpen, end: false},
    {to: marketplaceRoute.sales(id), label: t("cms_marketplace:nav.sales"), icon: CurrencyDollar, end: false},
    {to: marketplaceRoute.vouchers(id), label: t("cms_marketplace:nav.vouchers"), icon: Receipt, end: false},
  ];

  return (
    <nav aria-label={t("cms_marketplace:nav.label")} className="mb-6 flex flex-wrap gap-1">
      {items.map(({to, label, icon: Icon, end}) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({isActive}) =>
            cn(
              "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors",
              isActive
                ? "bg-accent-900/50 text-accent-200"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
            )
          }
        >
          <Icon size={16}/> {label}
        </NavLink>
      ))}
    </nav>
  );
};
