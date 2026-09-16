import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Plus} from "@phosphor-icons/react";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {cmsRoute} from "@/lib/cms/config.ts";
import type {CmsCollection} from "@/lib/cms/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";

export type JumpBackInProps = {collections: CmsCollection[]; className?: string};

/**
 * The reason to land here rather than on a section: one card per collection the service manages,
 * each a way straight into the list and a way straight into a blank entry.
 *
 * The cards are built from what `/collections` reports, name and description included, so a
 * collection the API grows shows up here without anyone editing this file.
 */
export const JumpBackIn = ({collections, className}: JumpBackInProps) => {
  const {t} = useTranslation(["cms_overview", "cms"]);

  return (
    <Panel
      className={className}
      title={t("cms_overview:collections.title")}
      description={t("cms_overview:collections.description")}
    >
      {collections.length === 0 ? (
        <EmptyState title={t("admin:common.no_collections")} description={t("cms_overview:collections.empty_hint")}/>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <li
              key={collection.slug}
              className="relative flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-neutral-800 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* The stretched pseudo-element makes the whole card the collection link without
                    nesting anything inside an anchor; the button below lifts itself back out. */}
                <Link
                  to={cmsRoute.content(collection.slug)}
                  className="text-sm text-text after:absolute after:inset-0 after:content-['']"
                  data-fs-hover
                >
                  {collection.name}
                </Link>
                <Badge size="sm">{collection.slug}</Badge>
              </div>

              <p className="text-[13px] leading-relaxed text-neutral-500">{collection.description}</p>

              <Button variant="ghost" size="sm" asChild className="relative mt-2 -ml-2 self-start" data-fs-hover>
                <Link to={cmsRoute.contentNew(collection.slug)}>
                  <Plus size={14}/> {t("cms_overview:collections.new_entry")}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};
