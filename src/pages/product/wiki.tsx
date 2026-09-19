import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Navigate, useParams} from "react-router-dom";
import {BookOpen} from "@phosphor-icons/react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {productRoute} from "@/lib/marketplace/config.ts";
import {flattenWiki, useProductWiki, useProductWikiPage} from "@/lib/marketplace/content.ts";
import {SectionError} from "@/pages/home/components/section-state.tsx";
import {useProductPage} from "@/pages/product/product-context.ts";
import {ProductProse} from "@/pages/product/components/product-prose.tsx";
import {WikiSidebar} from "@/pages/product/components/wiki-sidebar.tsx";

/**
 * The Wiki tab: a reading pane with the page list beside it, on the right.
 *
 * Two requests rather than one: the sidebar is the whole tree without bodies, and the open page is
 * fetched on its own. That is what keeps switching pages from re-fetching the navigation, and what
 * keeps a wiki of forty pages from shipping forty Markdown documents to show one.
 *
 * `/wiki` with no page in the address redirects to the first entry rather than showing an index.
 * A wiki's first page *is* its index — that is what editors write there — and a second landing
 * screen listing the same links as the sidebar beside it is a page nobody reads twice.
 */
export const ProductWiki = () => {
  const {t, i18n} = useTranslation(["product"]);
  const {slug} = useProductPage();
  const {page} = useParams<{page?: string}>();

  const tree = useProductWiki(slug);
  const nodes = useMemo(() => tree.data ?? [], [tree.data]);
  const ordered = useMemo(() => flattenWiki(nodes), [nodes]);

  /* Only asked for once the sidebar has resolved, so a bad slug is told apart from "not loaded yet". */
  const known = page && ordered.some((node) => node.slug === page) ? page : null;
  const document = useProductWikiPage(slug, known);

  if (tree.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={24} label={t("product:loading")}/>
      </div>
    );
  }

  if (tree.error) return <SectionError error={tree.error} onRetry={tree.reload}/>;

  if (ordered.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <BookOpen size={18}/> {t("product:wiki.empty")}
      </p>
    );
  }

  /* No page asked for, or one that is not published: open the first entry instead of a dead end. */
  if (!known) return <Navigate to={productRoute.wikiPage(slug, ordered[0].slug)} replace/>;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)] lg:items-start">
      {/*
        * Source order puts the article first and the sidebar second, which is also the order it is
        * read in on a narrow screen and by a screen reader. The grid column swaps nothing: on `lg`
        * the article is already the first column and the navigation the second, so the visual order
        * and the document order agree — the sidebar being on the right is what the layout asks for
        * and what the markup says.
        */}
      <article className="min-w-0">
        {document.loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={22} label={t("product:loading")}/>
          </div>
        ) : document.error ? (
          <SectionError error={document.error} onRetry={document.reload}/>
        ) : document.data ? (
          <>
            <h2 className="text-[30px] leading-tight text-text">{document.data.title}</h2>
            {document.data.updated_at && (
              <p className="mt-2 text-[13px] text-neutral-600">
                {t("product:wiki.updated", {date: formatDate(document.data.updated_at, i18n.language)})}
              </p>
            )}
            {document.data.body?.trim() ? (
              <ProductProse source={document.data.body} className="mt-8"/>
            ) : (
              <p className="mt-8 text-sm text-neutral-500">{t("product:wiki.page_empty")}</p>
            )}
          </>
        ) : null}
      </article>

      <WikiSidebar
        slug={slug}
        nodes={nodes}
        className="lg:sticky lg:top-8 lg:rounded-[var(--radius-lg)] lg:bg-surface lg:p-3 lg:shadow-[var(--shadow-sm)]"
      />
    </div>
  );
};
