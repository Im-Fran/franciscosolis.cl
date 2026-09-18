import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";

type Row = Record<string, unknown>;

/** Who changed what. Never the text of a message — that is somebody's personal data. */
export const AuditLog = () => {
  const {t, i18n} = useTranslation("support_agent");
  const locale = i18n.resolvedLanguage ?? "en";

  const entries = useResource(useCallback((signal: AbortSignal) => supportApi.audit({limit: 100}, signal), []));

  const columns: Column<Row>[] = [
    {key: "event", header: "event", cell: (row) => <code className="text-xs text-neutral-400">{String(row.event)}</code>},
    {key: "actor", header: "actor", cell: (row) => String(row.actor_email ?? "—")},
    {
      key: "resource",
      header: "resource",
      cell: (row) => <span className="text-xs text-neutral-500">{String(row.resource_type ?? "")}</span>,
      hideBelowLg: true,
    },
    {
      key: "created",
      header: t("inbox.updated"),
      cell: (row) => <span className="text-neutral-500">{formatDateTime(row.created_at as string, locale)}</span>,
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={t("audit.title")} />
      {!entries.loading && (entries.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("audit.empty")} />
      ) : (
        <DataTable rows={entries.data ?? []} columns={columns} rowKey={(row) => String(row.id)} />
      )}
    </section>
  );
};
