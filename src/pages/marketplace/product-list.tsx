import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {
  ArrowClockwise,
  ArrowSquareOut,
  ArrowsDownUp,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  SquaresFour,
  Trash,
} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {productRoute, marketplaceRoute} from "@/lib/marketplace/config.ts";
import type {Product} from "@/lib/marketplace/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {SortableList} from "@/components/admin/sortable-list.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";

/**
 * Every product page, drafts included.
 *
 * The set is small by nature — these are products, not posts — so the API hands the whole thing
 * back at once, the search filters in the browser, and this screen never pages.
 *
 * Reordering is a mode rather than always-on, for the same reason it is in the CMS's content list:
 * a list you can accidentally drag is a list whose order you cannot trust. The new order is local
 * until it is saved, because the API takes the whole thing in one call and committing on every drop
 * would fire a write per nudge.
 */
export const ProductList = () => {
  const {t, i18n} = useTranslation(["marketplace_admin", "cms"]);
  const navigate = useNavigate();
  const {notify} = useToast();
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState<Product[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const products = useResource(useCallback((signal: AbortSignal) => marketplaceApi.products.list({}, signal), []));
  const remove = useMutation(useCallback((id: string) => marketplaceApi.products.remove(id), []));
  const reorder = useMutation(
    useCallback((items: {id: string; position: number}[]) => marketplaceApi.products.reorder(items), []),
  );
  /* Pulled out because the mutation object itself is a new value on every render. */
  const resetRemoveError = remove.reset;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = products.data ?? [];
    if (!needle) return all;
    return all.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle) ||
        (product.tagline ?? "").toLowerCase().includes(needle),
    );
  }, [products.data, search]);

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        key: "name",
        header: t("marketplace_admin:list.columns.product"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{row.name}</p>
            <p className="truncate font-mono text-[12px] text-neutral-500">/product/{row.slug}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: t("marketplace_admin:list.columns.status"),
        className: "w-32",
        cell: (row) => <StatusBadge status={row.status}/>,
      },
      {
        key: "tabs",
        header: t("marketplace_admin:list.columns.tabs"),
        className: "w-44",
        hideBelowLg: true,
        cell: (row) => (
          <span className="text-[12px] text-neutral-400">
            {row.tabs.map((tab) => t(`product:tabs.${tab}`, {defaultValue: tab})).join(" · ")}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: t("marketplace_admin:list.columns.updated"),
        className: "w-36",
        hideBelowLg: true,
        cell: (row) =>
          formatDate(row.updated_at, i18n.language) ?? <span className="text-neutral-600">{t("admin:common.none")}</span>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("marketplace_admin:list.columns.actions")}</span>,
        className: "w-32 pr-0 text-right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            {/* Only a published page has a public address worth opening. */}
            {row.status === "published" && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label={t("marketplace_admin:list.view_aria", {name: row.name})}
                className="size-9"
              >
                <a
                  href={productRoute.overview(row.slug)}
                  target="_blank"
                  rel="noopener"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ArrowSquareOut size={16}/>
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t("marketplace_admin:list.edit_aria", {name: row.name})}
              className="size-9"
            >
              <Link to={marketplaceRoute.item(row.id)} onClick={(event) => event.stopPropagation()}>
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
              aria-label={t("marketplace_admin:list.delete_aria", {name: row.name})}
              className="size-9 text-neutral-400 hover:text-red-300"
            >
              <Trash size={16}/>
            </Button>
          </div>
        ),
      },
    ],
    [i18n.language, resetRemoveError, t],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const outcome = await remove.run(pendingDelete.id);
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setPendingDelete(null);
    products.reload();
  };

  const saveOrder = async () => {
    if (!ordering) return;
    const outcome = await reorder.run(ordering.map((row, index) => ({id: row.id, position: index})));
    if (!outcome.ok) return;
    notify(t("admin:common.saved"));
    setOrdering(null);
    products.reload();
  };

  const total = products.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title={t("marketplace_admin:list.title")}
        description={t("marketplace_admin:list.description")}
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
                    {t("marketplace_admin:list.save_order")}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setOrdering(rows)}>
                  <ArrowsDownUp size={16}/> {t("marketplace_admin:list.reorder")}
                </Button>
              ))}
            <Button asChild>
              <Link to={marketplaceRoute.new}>
                <Plus size={16}/> {t("marketplace_admin:list.new")}
              </Link>
            </Button>
          </>
        }
      />

      <Panel
        title={t("marketplace_admin:list.panel_title")}
        description={total > 0 ? t("marketplace_admin:list.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={products.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        {total > 0 && !ordering && (
          <div className="relative mb-5">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("marketplace_admin:list.search_placeholder")}
              aria-label={t("marketplace_admin:list.search_placeholder")}
              className="pl-9"
            />
          </div>
        )}

        {reorder.error && (
          <p className="mb-4 text-[13px] text-red-300">
            {t(`admin:errors.${reorder.error}`, {defaultValue: reorder.error})}
          </p>
        )}

        <PanelState
          loading={products.loading}
          error={products.error}
          forbidden={products.status === 403}
          onRetry={products.reload}
          ns="cms"
        >
          {total === 0 ? (
            <EmptyState
              icon={<SquaresFour size={28}/>}
              title={t("marketplace_admin:list.empty_title")}
              description={t("marketplace_admin:list.empty_description")}
              action={
                <Button asChild>
                  <Link to={marketplaceRoute.new}>
                    <Plus size={16}/> {t("marketplace_admin:list.empty_action")}
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
              label={t("marketplace_admin:list.reorder_label")}
              renderItem={(row) => (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{row.name}</span>
                  <StatusBadge status={row.status}/>
                </div>
              )}
            />
          ) : rows.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">{t("marketplace_admin:list.no_matches", {search: search.trim()})}</p>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(marketplaceRoute.item(row.id))}
              caption={t("marketplace_admin:list.caption")}
            />
          )}
        </PanelState>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("marketplace_admin:list.delete_title")}
        /* Named in full because this one cascades: the release notes and the wiki go with it. */
        body={t("marketplace_admin:list.delete_body", {name: pendingDelete?.name ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("marketplace_admin:list.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
