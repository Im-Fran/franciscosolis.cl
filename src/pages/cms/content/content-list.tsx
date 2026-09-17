import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {
  ArrowClockwise,
  ArrowsDownUp,
  Broom,
  FloppyDisk,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {CONTENT_STATUSES} from "@/lib/cms/types.ts";
import type {ContentItem, ContentStatus} from "@/lib/cms/types.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import type {Column} from "@/components/admin/data-table.tsx";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {SortableList} from "@/components/admin/sortable-list.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {useCollectionMeta} from "@/pages/cms/content/use-collection.ts";

const PAGE_SIZE = 25;

/** The API caps the `search` filter at 120 characters and a tag at 60. */
const SEARCH_MAX = 120;
const TAG_MAX = 60;

/**
 * Everything in one collection — whichever collection the route names.
 *
 * The screen knows nothing about `projects` or `experience` in particular: the slug comes from the
 * URL and its name from the collections the service reports, so a collection added on the API is
 * browsable here without a release.
 */
export const ContentList = () => {
  const {t, i18n} = useTranslation(["cms_content", "cms"]);
  const {collection = ""} = useParams();
  const navigate = useNavigate();
  const {notify} = useToast();
  const meta = useCollectionMeta(collection);

  const [searchDraft, setSearchDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<ContentStatus | "">("");
  const [offset, setOffset] = useState(0);

  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<ContentItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ContentItem | null>(null);

  /* Debounced together: typing a word into either box should cost one request, not one per key. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchDraft.trim());
      setTag(tagDraft.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft, tagDraft]);

  /* Every collection shares this route, so switching sections reuses the component — and would keep
     the previous section's filters and page unless they are cleared by hand. */
  useEffect(() => {
    setSearchDraft("");
    setTagDraft("");
    setSearch("");
    setTag("");
    setStatus("");
    setOffset(0);
    setReordering(false);
  }, [collection]);

  const list = useResource(
    useCallback(
      (signal: AbortSignal) =>
        cmsApi.content.list(
          collection,
          {
            status: status || undefined,
            search: search || undefined,
            tag: tag || undefined,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [collection, status, search, tag, offset],
    ),
  );

  const remove = useMutation(useCallback((id: string) => cmsApi.content.remove(collection, id), [collection]));

  /* Dragging only rearranges local state: the endpoint takes the whole order in one call, so writing
     on every drop would fire a request per nudge — and one of them failing halfway through a
     rearrangement would leave the collection renumbered against an order nobody chose. */
  const reorder = useMutation(
    useCallback(
      (rows: ContentItem[]) =>
        cmsApi.content.reorder(
          collection,
          rows.map((row, index) => ({id: row.id, position: index})),
        ),
      [collection],
    ),
  );

  const items = list.data ?? [];
  const rows = reordering ? order : items;

  const filtered = Boolean(searchDraft || tagDraft || status);
  /* The drag list only ever holds the rows on screen, so an order saved from a filtered or paged
     view would renumber a fraction of the collection against positions it cannot see. */
  const canReorder = !filtered && offset === 0;

  const clearFilters = () => {
    setSearchDraft("");
    setTagDraft("");
    setStatus("");
    setOffset(0);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const outcome = await remove.run(pendingDelete.id);
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setPendingDelete(null);
    remove.reset();
    list.reload();
  };

  const saveOrder = async () => {
    const outcome = await reorder.run(order);
    if (!outcome.ok) return;
    notify(t("cms_content:list.order_saved"));
    setReordering(false);
    list.reload();
  };

  const columns: Column<ContentItem>[] = [
    {
      key: "title",
      header: t("cms_content:list.column_title"),
      cell: (row) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm text-text">
            {row.featured && (
              <Star size={13} weight="fill" className="shrink-0 text-amber-400" alt={t("cms_content:list.featured")}/>
            )}
            {row.title}
          </p>
          <p className="truncate font-mono text-[11px] text-neutral-600">{row.slug}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("cms_content:list.column_status"),
      className: "w-32",
      cell: (row) => <StatusBadge status={row.status}/>,
    },
    {
      key: "tags",
      header: t("cms_content:list.column_tags"),
      hideBelowLg: true,
      cell: (row) =>
        row.tags && row.tags.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {row.tags.slice(0, 3).map((entry) => (
              <Badge key={entry} variant="neutral" size="sm">{entry}</Badge>
            ))}
            {row.tags.length > 3 && (
              <Badge variant="outline" size="sm">+{row.tags.length - 3}</Badge>
            )}
          </span>
        ) : (
          <span className="text-neutral-600">{t("admin:common.none")}</span>
        ),
    },
    {
      key: "updated_at",
      header: t("cms_content:list.column_updated"),
      hideBelowLg: true,
      className: "w-48",
      cell: (row) => (
        <span className="text-neutral-500">
          {formatDateTime(row.updated_at, i18n.language) ?? t("admin:common.none")}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("cms_content:list.column_actions")}</span>,
      className: "w-24 text-right",
      cell: (row) => (
        <span className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-9" asChild data-fs-hover>
            <Link
              to={cmsRoute.contentItem(collection, row.id)}
              aria-label={t("cms_content:list.edit_aria", {title: row.title})}
              onClick={(event) => event.stopPropagation()}
            >
              <PencilSimple size={15}/>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-neutral-400 hover:text-red-300"
            aria-label={t("cms_content:list.delete_aria", {title: row.title})}
            onClick={(event) => {
              event.stopPropagation();
              remove.reset();
              setPendingDelete(row);
            }}
            data-fs-hover
          >
            <Trash size={15}/>
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={meta.name}
        description={meta.known ? meta.description || undefined : t("cms_content:list.unknown_collection")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={list.reload} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            <Button variant="primary" size="sm" asChild data-fs-hover>
              <Link to={cmsRoute.contentNew(collection)}>
                <Plus size={15}/> {t("cms_content:list.new", {name: meta.singular})}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <Panel
          title={t("cms_content:list.filters_title")}
          description={t("cms_content:list.filters_description")}
          action={
            filtered && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-fs-hover>
                <Broom size={14}/> {t("admin:common.clear_filters")}
              </Button>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
            <Field label={t("admin:common.search")} htmlFor="content-search">
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"
                />
                <Input
                  id="content-search"
                  type="search"
                  value={searchDraft}
                  maxLength={SEARCH_MAX}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder={t("cms_content:list.search_placeholder")}
                  className="pl-9"
                />
              </div>
            </Field>

            <Field label={t("cms_content:list.status_filter")} htmlFor="content-status">
              <Select
                id="content-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as ContentStatus | "");
                  setOffset(0);
                }}
              >
                <option value="">{t("admin:common.filter_all")}</option>
                {CONTENT_STATUSES.map((entry) => (
                  <option key={entry} value={entry}>{t(`admin:status.${entry}`)}</option>
                ))}
              </Select>
            </Field>

            <Field
              label={t("cms_content:list.tag_filter")}
              htmlFor="content-tag"
              hint={t("cms_content:list.tag_filter_hint")}
            >
              <Input
                id="content-tag"
                value={tagDraft}
                maxLength={TAG_MAX}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder={t("cms_content:list.tag_placeholder")}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title={t("cms_content:list.entries_title", {name: meta.name})}
          description={
            reordering ? t("cms_content:list.reorder_description") : t("cms_content:list.entries_description")
          }
          action={
            canReorder ?
              reordering ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={reorder.pending}
                    onClick={() => {
                      setOrder(items);
                      setReordering(false);
                      reorder.reset();
                    }}
                    data-fs-hover
                  >
                    {t("admin:common.cancel")}
                  </Button>
                  <Button variant="primary" size="sm" disabled={reorder.pending} onClick={saveOrder} data-fs-hover>
                    {reorder.pending ? <Spinner size={14}/> : <FloppyDisk size={15}/>}
                    {t("cms_content:list.save_order")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={items.length < 2}
                  onClick={() => {
                    setOrder(items);
                    setReordering(true);
                  }}
                  data-fs-hover
                >
                  <ArrowsDownUp size={15}/> {t("cms_content:list.reorder")}
                </Button>
              )
            : <span className="max-w-[16rem] text-right text-[11px] leading-snug text-neutral-600">
                {t("cms_content:list.reorder_unavailable")}
              </span>
          }
        >
          <PanelState
            loading={list.loading}
            error={list.error}
            forbidden={list.status === 403}
            onRetry={list.reload}
            ns="cms"
          >
            {rows.length === 0 ?
              filtered ?
                <EmptyState
                  icon={<MagnifyingGlass size={26}/>}
                  title={t("cms_content:list.no_matches_title")}
                  description={t("cms_content:list.no_matches_description")}
                  action={
                    <Button variant="secondary" size="sm" onClick={clearFilters} data-fs-hover>
                      <Broom size={14}/> {t("admin:common.clear_filters")}
                    </Button>
                  }
                />
              : <EmptyState
                  icon={<Plus size={26}/>}
                  title={t("cms_content:list.empty_title", {name: meta.name})}
                  description={t("cms_content:list.empty_description", {name: meta.singular})}
                  action={
                    <Button variant="primary" size="sm" asChild data-fs-hover>
                      <Link to={cmsRoute.contentNew(collection)}>
                        <Plus size={15}/> {t("cms_content:list.empty_cta", {name: meta.singular})}
                      </Link>
                    </Button>
                  }
                />
            : reordering ?
              <>
                {reorder.error && (
                  <p className="mb-3 text-xs text-red-400">
                    {t(`admin:errors.${reorder.error}`, {defaultValue: reorder.error})}
                  </p>
                )}
                <SortableList
                  items={order}
                  itemKey={(row) => row.id}
                  onReorder={setOrder}
                  disabled={reorder.pending}
                  label={t("cms_content:list.reorder_label", {name: meta.name})}
                  renderItem={(row) => (
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {row.featured && <Star size={13} weight="fill" className="shrink-0 text-amber-400"/>}
                        <span className="truncate text-sm text-text">{row.title}</span>
                      </span>
                      <span className="truncate font-mono text-[11px] text-neutral-600">{row.slug}</span>
                      <StatusBadge status={row.status} className="ml-auto"/>
                    </div>
                  )}
                />
              </>
            : <>
                <DataTable
                  columns={columns}
                  rows={items}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => navigate(cmsRoute.contentItem(collection, row.id))}
                  caption={t("cms_content:list.caption", {name: meta.name})}
                />
                <Pagination
                  offset={offset}
                  limit={PAGE_SIZE}
                  count={items.length}
                  onChange={setOffset}
                  disabled={list.loading}
                />
              </>
            }
          </PanelState>
        </Panel>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cms_content:list.delete_title", {name: meta.singular})}
        body={t("cms_content:list.delete_body", {title: pendingDelete?.title ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          setPendingDelete(null);
          remove.reset();
        }}
      />
    </>
  );
};
