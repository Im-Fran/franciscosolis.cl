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

/**
 * Everything this service has sent.
 *
 * "Why did they never get the email" is the question a support system gets asked about itself, and
 * the answer has to be somewhere an agent can reach without opening a log viewer. A message that
 * failed and one that was never attempted look different here, which is the whole reason the log
 * exists.
 */
export const EmailList = () => {
  const {t, i18n} = useTranslation("support_agent");
  const locale = i18n.resolvedLanguage ?? "en";

  const emails = useResource(useCallback((signal: AbortSignal) => supportApi.emails({limit: 100}, signal), []));

  const columns: Column<Row>[] = [
    {key: "kind", header: "kind", cell: (row) => <code className="text-xs text-neutral-400">{String(row.kind)}</code>},
    {key: "to", header: "to", cell: (row) => (row.to as string[])?.join(", ") ?? ""},
    {key: "subject", header: "subject", cell: (row) => String(row.subject ?? ""), hideBelowLg: true},
    {
      key: "status",
      header: "status",
      cell: (row) => (
        <span className={row.status === "failed" ? "text-red-300" : "text-neutral-400"}>{String(row.status)}</span>
      ),
    },
    {
      key: "error",
      header: "error",
      cell: (row) => <span className="text-xs text-red-300">{String(row.error ?? "")}</span>,
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
      <PageHeader title={t("emails.title")} />
      {!emails.loading && (emails.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("emails.empty")} />
      ) : (
        <DataTable rows={emails.data ?? []} columns={columns} rowKey={(row) => String(row.id)} />
      )}
    </section>
  );
};
