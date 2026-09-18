import {useTranslation} from "react-i18next";
import {NavLink} from "react-router-dom";
import {BookOpen, CaretRight} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {applicationRoute} from "@/lib/pages/config.ts";
import type {WikiNode} from "@/lib/pages/types.ts";

/**
 * The wiki's navigation.
 *
 * It is a real `<nav>` of links, not a tree widget: every page has its own address, so the browser's
 * own affordances — middle-click, copy link, back — all work, and there is no expanded/collapsed
 * state to lose on a reload. The tree is two levels deep by rule on the service, which is exactly
 * what makes rendering it as a flat list with one indent legible rather than a puzzle.
 */
export const WikiSidebar = ({
  slug,
  nodes,
  className,
}: {
  slug: string;
  nodes: WikiNode[];
  className?: string;
}) => {
  const {t} = useTranslation(["application"]);

  const link = (node: WikiNode, nested: boolean) => (
    <NavLink
      key={node.id}
      to={applicationRoute.wikiPage(slug, node.slug)}
      className={({isActive}) =>
        cn(
          "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors",
          nested && "ml-3 border-l border-neutral-800 pl-4 text-[12.5px]",
          isActive
            ? "bg-[var(--page-accent,var(--color-accent))] font-medium text-bg"
            : "text-neutral-400 hover:bg-neutral-800/60 hover:text-text",
        )
      }
    >
      {!nested && <BookOpen size={15} className="shrink-0"/>}
      {nested && <CaretRight size={12} className="shrink-0 opacity-60"/>}
      <span className="truncate">{node.title}</span>
    </NavLink>
  );

  return (
    <nav aria-label={t("application:wiki.nav_label")} className={cn("flex flex-col gap-1", className)}>
      <p className="px-3 pb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">
        {t("application:wiki.nav_title")}
      </p>
      {nodes.map((node) => (
        <div key={node.id} className="flex flex-col gap-1">
          {link(node, false)}
          {node.children.map((child) => link(child, true))}
        </div>
      ))}
    </nav>
  );
};
