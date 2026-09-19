import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {ArrowClockwise, Note, PencilSimple, Plus, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import type {ProductRelease} from "@/lib/marketplace/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {ProductNav} from "@/pages/cms/marketplace/components/product-nav.tsx";

/**
 * One product's changelog, drafts included.
 *
 * There is no reorder here, and there should not be: a changelog's order is the release dates, and
 * a manual position would be a second, quieter way of saying when something shipped. Moving an
 * entry means correcting its date.
 */
export const ReleaseList = () => {
  const {t, i18n} = useTranslation(["cms_marketplace", "cms"]);
  const {id = ""} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const [pendingDelete, setPendingDelete] = useState<ProductRelease | null>(null);

  const product = useResource(
    useCallback((signal: AbortSignal) => marketplaceApi.products.get(id, signal), [id]),
  );
  const releases = useResource(useCallback((signal: AbortSignal) => marketplaceApi.releases.list(id, {}, signal), [id]));
  const remove = useMutation(useCallback((releaseId: string) => marketplaceApi.releases.remove(id, releaseId), [id]));
  const resetRemoveError = remove.reset;

  const columns = useMemo<Column<ProductRelease>[]>(
    () => [
      {
        key: "version",
        header: t("cms_marketplace:releases.columns.version"),
        className: "w-28",
        cell: (row) => <span className="font-mono text-[13px] text-accent-300">{row.version}</span>,
      },
      {
        key: "title",
        header: t("cms_marketplace:releases.columns.title"),
        cell: (row) => <span className="text-sm text-text">{row.title}</span>,
      },
      {
        key: "status",
        header: t("cms_marketplace:releases.columns.status"),
        className: "w-32",
        cell: (row) => <StatusBadge status={row.status}/>,
      },
      {
        key: "released_at",
        header: t("cms_marketplace:releases.columns.released"),
        className: "w-36",
        cell: (row) =>
          formatDate(row.released_at, i18n.language) ?? (
            <span className="text-neutral-600">{t("admin:common.none")}</span>
          ),
      },
      {
        key: "links",
        header: t("cms_marketplace:releases.columns.links"),
        className: "w-20",
        hideBelowLg: true,
        cell: (row) => <span className="text-[13px] text-neutral-400">{row.links.length || "—"}</span>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("cms_marketplace:releases.columns.actions")}</span>,
        className: "w-24 pr-0 text-right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t("cms_marketplace:releases.edit_aria", {version: row.version})}
              className="size-9"
            >
              <Link to={marketplaceRoute.releaseItem(id, row.id)} onClick={(event) => event.stopPropagation()}>
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
              aria-label={t("cms_marketplace:releases.delete_aria", {version: row.version})}
              className="size-9 text-neutral-400 hover:text-red-300"
            >
              <Trash size={16}/>
            </Button>
          </div>
        ),
      },
    ],
    [i18n.language, id, resetRemoveError, t],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const outcome = await remove.run(pendingDelete.id);
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setPendingDelete(null);
    releases.reload();
  };

  const total = releases.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title={t("cms_marketplace:releases.title")}
        description={t("cms_marketplace:releases.description", {name: product.data?.name ?? ""})}
        back={{to: marketplaceRoute.list, label: t("cms_marketplace:editor.back")}}
        actions={
          <Button asChild>
            <Link to={marketplaceRoute.releaseNew(id)}>
              <Plus size={16}/> {t("cms_marketplace:releases.new")}
            </Link>
          </Button>
        }
      />

      <ProductNav id={id}/>

      <Panel
        title={t("cms_marketplace:releases.panel_title")}
        description={total > 0 ? t("cms_marketplace:releases.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={releases.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        <PanelState
          loading={releases.loading}
          error={releases.error}
          forbidden={releases.status === 403}
          onRetry={releases.reload}
          ns="cms"
        >
          {total === 0 ? (
            <EmptyState
              icon={<Note size={28}/>}
              title={t("cms_marketplace:releases.empty_title")}
              description={t("cms_marketplace:releases.empty_description")}
              action={
                <Button asChild>
                  <Link to={marketplaceRoute.releaseNew(id)}>
                    <Plus size={16}/> {t("cms_marketplace:releases.empty_action")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={releases.data ?? []}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(marketplaceRoute.releaseItem(id, row.id))}
              caption={t("cms_marketplace:releases.caption")}
            />
          )}
        </PanelState>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cms_marketplace:releases.delete_title")}
        body={t("cms_marketplace:releases.delete_body", {version: pendingDelete?.version ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_marketplace:releases.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
