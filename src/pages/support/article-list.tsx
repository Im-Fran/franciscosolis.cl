import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Plus} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import {supportRoute} from "@/lib/support/config.ts";
import type {AdminArticle} from "@/lib/support/types.ts";

export const ArticleList = () => {
  const {t, i18n} = useTranslation("support_agent");
  const locale = i18n.resolvedLanguage ?? "en";

  const articles = useResource(useCallback((signal: AbortSignal) => supportApi.help.articles({}, signal), []));

  const columns: Column<AdminArticle>[] = [
    {
      key: "title",
      header: t("articles.article_title"),
      cell: (row) => (
        <Link to={supportRoute.article(row.id)} className="text-text hover:text-accent-200" data-fs-hover>
          {row.title}
        </Link>
      ),
    },
    {key: "slug", header: t("articles.slug"), cell: (row) => <code className="text-xs text-neutral-500">{row.slug}</code>},
    {key: "status", header: t("articles.status"), cell: (row) => <StatusBadge status={row.status} />},
    {
      key: "translations",
      header: t("articles.translations"),
      cell: (row) => {
        const locales = Object.keys(row.translations ?? {});
        return locales.length > 0 ? (
          <span className="text-xs text-neutral-400">{locales.join(", ")}</span>
        ) : (
          <span className="text-neutral-600">—</span>
        );
      },
      hideBelowLg: true,
    },
    {
      key: "updated",
      header: t("inbox.updated"),
      cell: (row) => <span className="text-neutral-500">{formatDateTime(row.updated_at, locale)}</span>,
      hideBelowLg: true,
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        title={t("articles.title")}
        actions={
          <Button asChild size="sm" data-fs-hover>
            <Link to={supportRoute.articleNew}>
              <Plus size={15} /> {t("articles.new")}
            </Link>
          </Button>
        }
      />

      {!articles.loading && (articles.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("articles.empty")} />
      ) : (
        <DataTable rows={articles.data ?? []} columns={columns} rowKey={(row) => row.id} />
      )}
    </section>
  );
};
