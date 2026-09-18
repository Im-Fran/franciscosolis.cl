import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {ArrowClockwise, Copy, Envelope, MagnifyingGlass, PencilSimple, Plus, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Column} from "@/components/admin/data-table.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import type {EmailTemplate} from "@/lib/cms/types.ts";

/** A row only guarantees `id`, `slug` and `subject`, so the name falls back to the slug it is filed under. */
const displayName = (template: EmailTemplate) => template.name?.trim() || template.slug;

/**
 * Every email template the service can render, with the slug a send has to name to reach it.
 *
 * Filtering happens in the browser: `/admin/email-templates` takes no `search` parameter and
 * returns the whole collection in one call, so there is nothing to ask the API for that is not
 * already loaded here.
 */
export const TemplateList = () => {
  const {t, i18n} = useTranslation(["cms_templates", "cms"]);
  const navigate = useNavigate();
  const {notify} = useToast();

  const templates = useResource(useCallback((signal: AbortSignal) => cmsApi.templates.list(signal), []));
  const remove = useMutation(useCallback((id: string) => cmsApi.templates.remove(id), []));

  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = templates.data ?? [];
    if (!needle) return all;
    return all.filter((template) =>
      [template.name, template.slug, template.subject, template.description]
        .some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [templates.data, search]);

  const copySlug = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(slug);
      notify(t("admin:common.copied"));
    } catch {
      /* Clipboard access is denied outside a secure context; say so instead of failing silently. */
      notify(t("cms_templates:list.copy_failed"), "error");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const outcome = await remove.run(pendingDelete.id);
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setPendingDelete(null);
    templates.reload();
  };

  const columns: Column<EmailTemplate>[] = [
    {
      key: "name",
      header: t("cms_templates:list.columns.name"),
      cell: (template) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-text">{displayName(template)}</p>
          <span className="mt-0.5 flex items-center gap-1.5">
            <code className="truncate font-mono text-[12px] text-neutral-500">{template.slug}</code>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void copySlug(template.slug);
              }}
              aria-label={t("cms_templates:list.copy_slug", {slug: template.slug})}
              title={t("admin:common.copy")}
              className="cursor-pointer rounded-[var(--radius-sm)] p-1 text-neutral-600 transition-colors hover:bg-neutral-800 hover:text-text"
            >
              <Copy size={13}/>
            </button>
          </span>
        </div>
      ),
    },
    {
      key: "subject",
      header: t("cms_templates:list.columns.subject"),
      cell: (template) => <span className="line-clamp-2">{template.subject}</span>,
    },
    {
      key: "description",
      header: t("cms_templates:list.columns.description"),
      hideBelowLg: true,
      cell: (template) =>
        template.description ? (
          <span className="line-clamp-2 text-neutral-400">{template.description}</span>
        ) : (
          <span className="text-neutral-600">{t("admin:common.none")}</span>
        ),
    },
    {
      key: "updated",
      header: t("cms_templates:list.columns.updated"),
      hideBelowLg: true,
      className: "whitespace-nowrap",
      cell: (template) => (
        <span className="text-neutral-500">
          {formatDateTime(template.updated_at ?? template.created_at, i18n.language) ?? t("admin:common.none")}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("cms_templates:list.columns.actions")}</span>,
      className: "w-24 text-right",
      cell: (template) => (
        <span className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            asChild
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              to={cmsRoute.templateItem(template.id)}
              aria-label={t("cms_templates:list.edit", {name: displayName(template)})}
            >
              <PencilSimple size={15}/>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-neutral-400 hover:text-red-300"
            aria-label={t("cms_templates:list.delete", {name: displayName(template)})}
            onClick={(event) => {
              event.stopPropagation();
              remove.reset();
              setPendingDelete(template);
            }}
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
        title={t("cms_templates:list.title")}
        description={t("cms_templates:list.description")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={templates.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            <Button size="sm" asChild>
              <Link to={cmsRoute.templateNew}>
                <Plus size={14}/> {t("cms_templates:list.new")}
              </Link>
            </Button>
          </>
        }
      />

      <Panel title={t("cms_templates:list.panel_title")} description={t("cms_templates:list.panel_description")}>
        <div className="relative mb-5">
          <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"/>
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("cms_templates:list.search_placeholder")}
            aria-label={t("cms_templates:list.search_label")}
            className="pl-9"
          />
        </div>

        <PanelState
          loading={templates.loading}
          error={templates.error}
          forbidden={templates.status === 403}
          onRetry={templates.reload}
          ns="cms"
        >
          {templates.data?.length === 0 ?
            <EmptyState
              icon={<Envelope size={28}/>}
              title={t("cms_templates:list.empty_title")}
              description={t("cms_templates:list.empty_description")}
              action={
                <Button size="sm" asChild>
                  <Link to={cmsRoute.templateNew}>
                    <Plus size={14}/> {t("cms_templates:list.empty_action")}
                  </Link>
                </Button>
              }
            />
          : rows.length === 0 ?
            <p className="py-4 text-sm text-neutral-500">{t("cms_templates:list.no_matches", {query: search.trim()})}</p>
          : <DataTable
              columns={columns}
              rows={rows}
              rowKey={(template) => template.id}
              onRowClick={(template) => navigate(cmsRoute.templateItem(template.id))}
              caption={t("cms_templates:list.caption")}
            />
          }
        </PanelState>
      </Panel>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cms_templates:list.delete_title")}
        body={t("cms_templates:list.delete_body", {
          name: pendingDelete ? displayName(pendingDelete) : "",
          slug: pendingDelete?.slug ?? "",
        })}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_templates:list.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
