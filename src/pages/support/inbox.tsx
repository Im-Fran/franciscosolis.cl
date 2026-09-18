import {useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {MagnifyingGlass} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {TicketPriorityBadge, TicketStatusBadge} from "@/components/support/ticket-status-badge.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import {supportRoute} from "@/lib/support/config.ts";
import {useSupport} from "@/lib/support/support-context.ts";
import type {TicketSummary} from "@/lib/support/types.ts";

/**
 * The queue.
 *
 * Every filter lives in the query string rather than in component state, which is what makes an
 * inbox view something an agent can bookmark, share in a message and come back to after a reload —
 * "the unassigned urgent ones" is a URL, not a sequence of clicks.
 */
export const Inbox = () => {
  const {t, i18n} = useTranslation(["support_agent", "support"]);
  const {status: service, labels} = useSupport();
  const [params, setParams] = useSearchParams();
  const locale = i18n.resolvedLanguage ?? "en";

  const filters = useMemo(
    () => ({
      status: params.get("status") ?? undefined,
      priority: params.get("priority") ?? undefined,
      label: params.get("label") ?? undefined,
      unassigned: params.get("unassigned") === "true",
      q: params.get("q") ?? undefined,
    }),
    [params],
  );

  const tickets = useResource(
    useCallback(
      (signal: AbortSignal) => supportApi.tickets.list(filters as Parameters<typeof supportApi.tickets.list>[0], signal),
      [filters],
    ),
  );

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, {replace: true});
  };

  const columns: Column<TicketSummary>[] = [
    {
      key: "reference",
      header: t("inbox.reference"),
      cell: (row) => <span className="font-mono text-xs text-neutral-500">{row.reference}</span>,
    },
    {
      key: "subject",
      header: t("inbox.subject"),
      cell: (row) => (
        <Link to={supportRoute.ticket(row.id)} className="text-text hover:text-accent-200" data-fs-hover>
          {row.subject}
        </Link>
      ),
    },
    {
      key: "status",
      header: t("inbox.filter_status"),
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          <TicketStatusBadge status={row.status} />
          <TicketPriorityBadge priority={row.priority} />
        </span>
      ),
    },
    {key: "requester", header: t("inbox.requester"), cell: (row) => row.requester_email},
    {
      key: "assignee",
      header: t("inbox.assignee"),
      cell: (row) => row.assignee_email ?? <span className="text-neutral-600">—</span>,
    },
    {
      key: "updated",
      header: t("inbox.updated"),
      cell: (row) => <span className="text-neutral-500">{formatDateTime(row.updated_at, locale)}</span>,
    },
  ];

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={t("inbox.title")} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <MagnifyingGlass size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600" aria-hidden />
          <Input
            value={filters.q ?? ""}
            onChange={(event) => setFilter("q", event.target.value)}
            placeholder={t("inbox.search")}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status ?? ""}
          onChange={(event) => setFilter("status", event.target.value)}
          className="w-auto"
          aria-label={t("inbox.filter_status")}
        >
          <option value="">{t("inbox.all")}</option>
          {(service?.ticket_statuses ?? []).map((value) => (
            <option key={value} value={value}>
              {t(`support:ticket.statuses.${value}`)}
            </option>
          ))}
        </Select>

        <Select
          value={filters.label ?? ""}
          onChange={(event) => setFilter("label", event.target.value)}
          className="w-auto"
          aria-label={t("inbox.filter_label")}
        >
          <option value="">{t("inbox.all")}</option>
          {labels.map((label) => (
            <option key={label.id} value={label.slug}>
              {label.name}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={filters.unassigned}
            onChange={(event) => setFilter("unassigned", event.target.checked ? "true" : "")}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("inbox.unassigned_only")}
        </label>
      </div>

      {!tickets.loading && (tickets.data?.length ?? 0) === 0 ? (
        <EmptyState title={t("inbox.empty")} />
      ) : (
        <DataTable rows={tickets.data ?? []} columns={columns} rowKey={(row) => row.id} />
      )}
    </section>
  );
};
