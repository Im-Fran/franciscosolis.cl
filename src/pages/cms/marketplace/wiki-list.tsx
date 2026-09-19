import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {ArrowClockwise, ArrowsDownUp, BookOpen, CaretRight, PencilSimple, Plus, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import type {WikiPage} from "@/lib/marketplace/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {SortableList} from "@/components/admin/sortable-list.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {ProductNav} from "@/pages/cms/marketplace/components/product-nav.tsx";

/**
 * One product's wiki, as a flat list in sidebar order.
 *
 * Flat rather than a tree widget, with a nested page marked by an indent and a caret: the service
 * caps the sidebar at two levels, so there is no depth for a tree to reveal, and a list is the one
 * shape a drag-and-drop reorder reads correctly in.
 *
 * The order *is* the sidebar, which is why reordering is a mode here and not on the changelog: a
 * wiki has a reading order somebody chose, and a changelog has dates.
 */
export const WikiList = () => {
  const {t} = useTranslation(["cms_marketplace", "cms"]);
  const {id = ""} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const [ordering, setOrdering] = useState<WikiPage[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WikiPage | null>(null);

  const product = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.products.get(id, signal), [id]),
  );
  const pages = useResource(useCallback((signal: AbortSignal) => marketplaceApi.wiki.list(id, {}, signal), [id]));
  const remove = useMutation(useCallback((pageId: string) => marketplaceApi.wiki.remove(id, pageId), [id]));
  const reorder = useMutation(
    useCallback((items: {id: string; position: number}[]) => marketplaceApi.wiki.reorder(id, items), [id]),
  );
  const resetRemoveError = remove.reset;

  /* Memoised because `?? []` is a fresh array on every render, which would rebuild the map below
     — and the columns that read it — on each one. */
  const rows = useMemo(() => pages.data ?? [], [pages.data]);

  /** Titles by id, so a nested row can name the section it hangs under rather than show a UUID. */
  const titleById = useMemo(
    () => new Map(rows.map((row) => [row.id, row.title] as const)),
    [rows],
  );

  const columns = useMemo<Column<WikiPage>[]>(
    () => [
      {
        key: "title",
        header: t("cms_marketplace:wiki.columns.page"),
        cell: (row) => (
          <div className={row.parent_id ? "min-w-0 pl-5" : "min-w-0"}>
            <p className="flex items-center gap-1.5 truncate text-sm text-text">
              {row.parent_id && <CaretRight size={12} className="shrink-0 text-neutral-600"/>}
              {row.title}
            </p>
            <p className="truncate font-mono text-[12px] text-neutral-500">/{row.slug}</p>
          </div>
        ),
      },
      {
        key: "parent",
        header: t("cms_marketplace:wiki.columns.section"),
        className: "w-44",
        hideBelowLg: true,
        cell: (row) =>
          row.parent_id ? (
            <span className="text-[13px] text-neutral-400">
              {titleById.get(row.parent_id) ?? t("cms_marketplace:wiki.unknown_section")}
            </span>
          ) : (
            <span className="text-[13px] text-neutral-600">{t("cms_marketplace:wiki.top_level")}</span>
          ),
      },
      {
        key: "status",
        header: t("cms_marketplace:wiki.columns.status"),
        className: "w-32",
        cell: (row) => <StatusBadge status={row.status}/>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("cms_marketplace:wiki.columns.actions")}</span>,
        className: "w-24 pr-0 text-right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t("cms_marketplace:wiki.edit_aria", {title: row.title})}
              className="size-9"
            >
              <Link to={marketplaceRoute.wikiItem(id, row.id)} onClick={(event) => event.stopPropagation()}>
                <PencilSimple size={16}/>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                resetRemoveError();
                setPendingDelete(row);
              }}
              aria-label={t("cms_marketplace:wiki.delete_aria", {title: row.title})}
              className="size-9 text-neutral-400 hover:text-red-300"
            >
              <Trash size={16}/>
            </Button>
          </div>
        ),
      },
    ],
    [id, resetRemoveError, t, titleById],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const outcome = await remove.run(pendingDelete.id);
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setPendingDelete(null);
    pages.reload();
  };

  const saveOrder = async () => {
    if (!ordering) return;
    const outcome = await reorder.run(ordering.map((row, index) => ({id: row.id, position: index})));
    if (!outcome.ok) return;
    notify(t("admin:common.saved"));
    setOrdering(null);
    pages.reload();
  };

  const total = rows.length;

  return (
    <>
      <PageHeader
        title={t("cms_marketplace:wiki.title")}
        description={t("cms_marketplace:wiki.description", {name: product.data?.name ?? ""})}
        back={{to: marketplaceRoute.list, label: t("cms_marketplace:editor.back")}}
        actions={
          <>
            {total > 1 &&
              (ordering ? (
                <>
                  <Button variant="ghost" onClick={() => setOrdering(null)} disabled={reorder.pending}>
                    {t("admin:common.cancel")}
                  </Button>
                  <Button onClick={() => void saveOrder()} disabled={reorder.pending}>
                    {reorder.pending ? <Spinner size={16}/> : <ArrowsDownUp size={16}/>}
                    {t("cms_marketplace:wiki.save_order")}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setOrdering(rows)}>
                  <ArrowsDownUp size={16}/> {t("cms_marketplace:wiki.reorder")}
                </Button>
              ))}
            <Button asChild>
              <Link to={marketplaceRoute.wikiNew(id)}>
                <Plus size={16}/> {t("cms_marketplace:wiki.new")}
              </Link>
            </Button>
          </>
        }
      />

      <ProductNav id={id}/>

      <Panel
        title={t("cms_marketplace:wiki.panel_title")}
        description={total > 0 ? t("cms_marketplace:wiki.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={pages.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        {reorder.error && (
          <p className="mb-4 text-[13px] text-red-300">
            {t(`admin:errors.${reorder.error}`, {defaultValue: reorder.error})}
          </p>
        )}

        <PanelState
          loading={pages.loading}
          error={pages.error}
          forbidden={pages.status === 403}
          onRetry={pages.reload}
          ns="cms"
        >
          {total === 0 ? (
            <EmptyState
              icon={<BookOpen size={28}/>}
              title={t("cms_marketplace:wiki.empty_title")}
              description={t("cms_marketplace:wiki.empty_description")}
              action={
                <Button asChild>
                  <Link to={marketplaceRoute.wikiNew(id)}>
                    <Plus size={16}/> {t("cms_marketplace:wiki.empty_action")}
                  </Link>
                </Button>
              }
            />
          ) : ordering ? (
            <SortableList
              items={ordering}
              itemKey={(row) => row.id}
              onReorder={setOrdering}
              disabled={reorder.pending}
              label={t("cms_marketplace:wiki.reorder_label")}
              renderItem={(row) => (
                <div className="flex min-w-0 items-center gap-3">
                  <span className={row.parent_id ? "min-w-0 flex-1 truncate pl-5 text-sm text-text" : "min-w-0 flex-1 truncate text-sm text-text"}>
                    {row.title}
                  </span>
                  <StatusBadge status={row.status}/>
                </div>
              )}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(marketplaceRoute.wikiItem(id, row.id))}
              caption={t("cms_marketplace:wiki.caption")}
            />
          )}
        </PanelState>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cms_marketplace:wiki.delete_title")}
        /* Says what happens to the pages under it, because the answer is not "they go too". */
        body={t("cms_marketplace:wiki.delete_body", {title: pendingDelete?.title ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_marketplace:wiki.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
