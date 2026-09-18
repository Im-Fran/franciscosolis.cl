import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {BookOpen, Note, SquaresFour} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {pagesRoute} from "@/lib/pages/config.ts";

/**
 * Moving between the three things one application is made of, once it exists.
 *
 * It mirrors the tab bar a visitor sees, deliberately: an editor who knows the page knows this
 * navigation. Updates and Wiki are shown whether or not the application turned those tabs on —
 * writing the content is what usually comes *before* turning the tab on, and hiding the editor
 * until the tab is enabled would make that order impossible.
 */
export const ApplicationNav = ({id}: {id: string}) => {
  const {t} = useTranslation(["cms_pages"]);

  const items = [
    {to: pagesRoute.item(id), label: t("cms_pages:nav.page"), icon: SquaresFour, end: true},
    {to: pagesRoute.updates(id), label: t("cms_pages:nav.updates"), icon: Note, end: false},
    {to: pagesRoute.wiki(id), label: t("cms_pages:nav.wiki"), icon: BookOpen, end: false},
  ];

  return (
    <nav aria-label={t("cms_pages:nav.label")} className="mb-6 flex flex-wrap gap-1">
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
          data-fs-hover
        >
          <Icon size={16}/> {label}
        </NavLink>
      ))}
    </nav>
  );
};
