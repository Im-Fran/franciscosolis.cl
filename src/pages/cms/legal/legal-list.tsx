import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {ArrowClockwise, MagnifyingGlass, PencilSimple, Plus, Scroll, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import type {LegalDocument} from "@/lib/cms/types.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";

/**
 * Every legal document the site serves, drafts included.
 *
 * The set is small by nature — a privacy policy, some terms, maybe a cookie notice — so the API
 * hands the whole thing back at once and this screen never pages.
 */
export const LegalList = () => {
  const {t, i18n} = useTranslation(["cms_legal", "cms"]);
  const navigate = useNavigate();
  const {notify} = useToast();
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<LegalDocument | null>(null);

  const documents = useResource(useCallback((signal: AbortSignal) => cmsApi.legal.list(signal), []));
  const remove = useMutation(useCallback((id: string) => cmsApi.legal.remove(id), []));
  /* Pulled out because the mutation object itself is a new value on every render. */
  const resetRemoveError = remove.reset;

  /*
   * Filtered in the browser rather than on the server: `GET /admin/legal` takes no `search`
   * parameter, and since it already returns the complete set there is nothing to ask it for.
   */
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = documents.data ?? [];
    if (!needle) return all;
    return all.filter(
      (document) =>
        document.title.toLowerCase().includes(needle) ||
        document.slug.toLowerCase().includes(needle) ||
        (document.summary ?? "").toLowerCase().includes(needle),
    );
  }, [documents.data, search]);

  const columns = useMemo<Column<LegalDocument>[]>(
    () => [
      {
        key: "title",
        header: t("cms_legal:list.columns.document"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{row.title}</p>
            <p className="truncate font-mono text-[12px] text-neutral-500">/{row.slug}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: t("cms_legal:list.columns.status"),
        className: "w-32",
        cell: (row) => <StatusBadge status={row.status}/>,
      },
      {
        key: "version",
        header: t("cms_legal:list.columns.version"),
        className: "w-28",
        cell: (row) =>
          row.version ? (
            <span className="font-mono text-[12px] text-neutral-400">{row.version}</span>
          ) : (
            <span className="text-neutral-600">{t("admin:common.none")}</span>
          ),
      },
      {
        key: "effective_at",
        header: t("cms_legal:list.columns.effective"),
        className: "w-36",
        cell: (row) => formatDate(row.effective_at, i18n.language) ?? <span className="text-neutral-600">{t("admin:common.none")}</span>,
      },
      {
        key: "updated_at",
        header: t("cms_legal:list.columns.updated"),
        className: "w-36",
        hideBelowLg: true,
        cell: (row) => formatDate(row.updated_at, i18n.language) ?? <span className="text-neutral-600">{t("admin:common.none")}</span>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("cms_legal:list.columns.actions")}</span>,
        className: "w-24 pr-0 text-right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            {/* The row itself opens the editor; this is what makes it reachable from the keyboard. */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t("cms_legal:list.edit_aria", {title: row.title})}
              className="size-9"
              data-fs-hover
            >
              <Link to={cmsRoute.legalItem(row.id)} onClick={(event) => event.stopPropagation()}>
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
              aria-label={t("cms_legal:list.delete_aria", {title: row.title})}
              className="size-9 text-neutral-400 hover:text-red-300"
              data-fs-hover
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
    documents.reload();
  };

  const total = documents.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title={t("cms_legal:list.title")}
        description={t("cms_legal:list.description")}
        actions={
          <Button asChild data-fs-hover>
            <Link to={cmsRoute.legalNew}>
              <Plus size={16}/> {t("cms_legal:list.new")}
            </Link>
          </Button>
        }
      />

      <Panel
        title={t("cms_legal:list.panel_title")}
        description={total > 0 ? t("cms_legal:list.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={documents.reload} data-fs-hover>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      >
        {total > 0 && (
          <div className="relative mb-5">
            <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"/>
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("cms_legal:list.search_placeholder")}
              aria-label={t("cms_legal:list.search_placeholder")}
              className="pl-9"
            />
          </div>
        )}

        <PanelState
          loading={documents.loading}
          error={documents.error}
          forbidden={documents.status === 403}
          onRetry={documents.reload}
          ns="cms"
        >
          {total === 0 ? (
            <EmptyState
              icon={<Scroll size={28}/>}
              title={t("cms_legal:list.empty_title")}
              description={t("cms_legal:list.empty_description")}
              action={
                <Button asChild data-fs-hover>
                  <Link to={cmsRoute.legalNew}>
                    <Plus size={16}/> {t("cms_legal:list.empty_action")}
                  </Link>
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">{t("cms_legal:list.no_matches", {search: search.trim()})}</p>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(cmsRoute.legalItem(row.id))}
              caption={t("cms_legal:list.caption")}
            />
          )}
        </PanelState>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cms_legal:list.delete_title")}
        body={t("cms_legal:list.delete_body", {title: pendingDelete?.title ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_legal:list.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
