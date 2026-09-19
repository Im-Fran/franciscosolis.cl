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
import {pagesApi} from "@/lib/pages/client.ts";
import {applicationRoute, pagesRoute} from "@/lib/pages/config.ts";
import type {Application} from "@/lib/pages/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {SortableList} from "@/components/admin/sortable-list.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";

/**
 * Every application page, drafts included.
 *
 * The set is small by nature — these are products, not posts — so the API hands the whole thing
 * back at once, the search filters in the browser, and this screen never pages.
 *
 * Reordering is a mode rather than always-on, for the same reason it is in the CMS's content list:
 * a list you can accidentally drag is a list whose order you cannot trust. The new order is local
 * until it is saved, because the API takes the whole thing in one call and committing on every drop
 * would fire a write per nudge.
 */
export const ApplicationList = () => {
  const {t, i18n} = useTranslation(["cms_pages", "cms"]);
  const navigate = useNavigate();
  const {notify} = useToast();
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState<Application[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null);

  const applications = useResource(useCallback((signal: AbortSignal) => pagesApi.applications.list({}, signal), []));
  const remove = useMutation(useCallback((id: string) => pagesApi.applications.remove(id), []));
  const reorder = useMutation(
    useCallback((items: {id: string; position: number}[]) => pagesApi.applications.reorder(items), []),
  );
  /* Pulled out because the mutation object itself is a new value on every render. */
  const resetRemoveError = remove.reset;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = applications.data ?? [];
    if (!needle) return all;
    return all.filter(
      (application) =>
        application.name.toLowerCase().includes(needle) ||
        application.slug.toLowerCase().includes(needle) ||
        (application.tagline ?? "").toLowerCase().includes(needle),
    );
  }, [applications.data, search]);

  const columns = useMemo<Column<Application>[]>(
    () => [
      {
        key: "name",
        header: t("cms_pages:list.columns.application"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{row.name}</p>
            <p className="truncate font-mono text-[12px] text-neutral-500">/application/{row.slug}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: t("cms_pages:list.columns.status"),
        className: "w-32",
        cell: (row) => <StatusBadge status={row.status}/>,
      },
      {
        key: "tabs",
        header: t("cms_pages:list.columns.tabs"),
        className: "w-44",
        hideBelowLg: true,
        cell: (row) => (
          <span className="text-[12px] text-neutral-400">
            {row.tabs.map((tab) => t(`application:tabs.${tab}`, {defaultValue: tab})).join(" · ")}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: t("cms_pages:list.columns.updated"),
        className: "w-36",
        hideBelowLg: true,
        cell: (row) =>
          formatDate(row.updated_at, i18n.language) ?? <span className="text-neutral-600">{t("admin:common.none")}</span>,
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("cms_pages:list.columns.actions")}</span>,
        className: "w-32 pr-0 text-right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            {/* Only a published page has a public address worth opening. */}
            {row.status === "published" && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label={t("cms_pages:list.view_aria", {name: row.name})}
                className="size-9"
              >
                <a
                  href={applicationRoute.overview(row.slug)}
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
              aria-label={t("cms_pages:list.edit_aria", {name: row.name})}
              className="size-9"
            >
              <Link to={pagesRoute.item(row.id)} onClick={(event) => event.stopPropagation()}>
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
              aria-label={t("cms_pages:list.delete_aria", {name: row.name})}
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
    applications.reload();
  };

  const saveOrder = async () => {
    if (!ordering) return;
    const outcome = await reorder.run(ordering.map((row, index) => ({id: row.id, position: index})));
    if (!outcome.ok) return;
    notify(t("admin:common.saved"));
    setOrdering(null);
    applications.reload();
  };

  const total = applications.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title={t("cms_pages:list.title")}
        description={t("cms_pages:list.description")}
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
                    {t("cms_pages:list.save_order")}
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setOrdering(rows)}>
                  <ArrowsDownUp size={16}/> {t("cms_pages:list.reorder")}
                </Button>
              ))}
            <Button asChild>
              <Link to={pagesRoute.new}>
                <Plus size={16}/> {t("cms_pages:list.new")}
              </Link>
            </Button>
          </>
        }
      />

      <Panel
        title={t("cms_pages:list.panel_title")}
        description={total > 0 ? t("cms_pages:list.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={applications.reload}>
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
              placeholder={t("cms_pages:list.search_placeholder")}
              aria-label={t("cms_pages:list.search_placeholder")}
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
          loading={applications.loading}
          error={applications.error}
          forbidden={applications.status === 403}
          onRetry={applications.reload}
          ns="cms"
        >
          {total === 0 ? (
            <EmptyState
              icon={<SquaresFour size={28}/>}
              title={t("cms_pages:list.empty_title")}
              description={t("cms_pages:list.empty_description")}
              action={
                <Button asChild>
                  <Link to={pagesRoute.new}>
                    <Plus size={16}/> {t("cms_pages:list.empty_action")}
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
              label={t("cms_pages:list.reorder_label")}
              renderItem={(row) => (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{row.name}</span>
                  <StatusBadge status={row.status}/>
                </div>
              )}
            />
          ) : rows.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">{t("cms_pages:list.no_matches", {search: search.trim()})}</p>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(pagesRoute.item(row.id))}
              caption={t("cms_pages:list.caption")}
            />
          )}
        </PanelState>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cms_pages:list.delete_title")}
        /* Named in full because this one cascades: the release notes and the wiki go with it. */
        body={t("cms_pages:list.delete_body", {name: pendingDelete?.name ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_pages:list.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
