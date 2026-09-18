import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowClockwise, CaretDown, CaretRight, ClockCounterClockwise} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {AuditEntry} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

const PAGE_SIZE = 50;

/** A `<input type="date">` value as the inclusive bound the API wants, or undefined when cleared. */
const startOfDay = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const endOfDay = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);

/**
 * The authentication audit trail: every sign-in, token issuance, revocation and administrative
 * write, appended and never edited.
 *
 * The event names come from `GET /admin/audit/events` rather than from a list in this file. They
 * are the Worker's own closed set, so a filter built from them can never offer a value the trail
 * will not answer to, and an event added on the service appears here without a release.
 *
 * Every filter lives in the query string: an investigation is something you hand to somebody else.
 */
export const AuditLog = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const event = params.get("event") ?? "";
  const user = params.get("user") ?? "";
  const application = params.get("application") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;

  const entries = useResource(
    useCallback(
      (signal: AbortSignal) =>
        authApi.admin.audit(
          {
            event: event || undefined,
            user_id: user || undefined,
            application_id: application || undefined,
            from: startOfDay(from),
            to: endOfDay(to),
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [event, user, application, from, to, offset],
    ),
  );
  const events = useResource(useCallback((signal: AbortSignal) => authApi.admin.auditEvents(signal), []));
  const applications = useResource(
    useCallback(
      (signal: AbortSignal) => (can("applications:read") ? authApi.admin.applications(signal) : Promise.resolve([])),
      [can],
    ),
  );

  const rows = entries.data ?? [];
  const filtered = Boolean(event || user || application || from || to);

  const setParam = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "offset") next.delete("offset");
      return next;
    });

  const columns = useMemo<Column<AuditEntry>[]>(
    () => [
      {
        key: "event",
        header: t("auth_admin:audit.column_event"),
        className: "w-64",
        cell: (entry) => (
          <span className="flex items-center gap-2">
            {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
              expanded === entry.id ? <CaretDown size={12}/> : <CaretRight size={12}/>
            ) : (
              <span className="w-3"/>
            )}
            <span className="min-w-0">
              <span className="block truncate text-text">
                {t(`auth_admin:events.${entry.event}`, {defaultValue: entry.event})}
              </span>
              <code className="block truncate text-[11px] text-neutral-600">{entry.event}</code>
            </span>
          </span>
        ),
      },
      {
        key: "who",
        header: t("auth_admin:audit.column_who"),
        cell: (entry) =>
          entry.user_id ? (
            <Link
              to={adminRoute.user(entry.user_id)}
              onClick={(clickEvent) => clickEvent.stopPropagation()}
              className="underline-offset-2 hover:underline"
            >
              {entry.user_email ?? entry.user_id}
            </Link>
          ) : (
            <span className="text-neutral-600">{t("auth_admin:audit.anonymous")}</span>
          ),
      },
      {
        key: "application",
        header: t("auth_admin:audit.column_application"),
        className: "w-44",
        hideBelowLg: true,
        cell: (entry) => entry.application_name ?? entry.application_id ?? <span className="text-neutral-600">{t("admin:common.none")}</span>,
      },
      {
        key: "where",
        header: t("auth_admin:audit.column_where"),
        className: "w-48",
        hideBelowLg: true,
        cell: (entry) => (
          <span className="min-w-0">
            <span className="block truncate">{entry.ip ?? t("admin:common.none")}</span>
            <span className="block truncate text-[12px] text-neutral-600">
              {describeUserAgent(entry.user_agent) ?? ""}
            </span>
          </span>
        ),
      },
      {
        key: "when",
        header: t("auth_admin:audit.column_when"),
        className: "w-48",
        cell: (entry) => formatDateTime(entry.created_at, i18n.language),
      },
    ],
    [t, i18n.language, expanded],
  );

  return (
    <>
      <PageHeader
        title={t("auth_admin:audit.title")}
        description={t("auth_admin:audit.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={entries.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <Surface>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[13px] text-neutral-400">
            {t("auth_admin:audit.filter_event")}
            <select
              value={event}
              onChange={(changed) => setParam("event", changed.target.value)}
              className="h-9 min-w-56 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
            >
              <option value="">{t("admin:common.filter_all")}</option>
              {(events.data ?? []).map((name) => (
                <option key={name} value={name}>
                  {t(`auth_admin:events.${name}`, {defaultValue: name})}
                </option>
              ))}
            </select>
          </label>

          {(applications.data ?? []).length > 0 && (
            <label className="flex flex-col gap-1 text-[13px] text-neutral-400">
              {t("auth_admin:audit.filter_application")}
              <select
                value={application}
                onChange={(changed) => setParam("application", changed.target.value)}
                className="h-9 min-w-48 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
              >
                <option value="">{t("admin:common.filter_all")}</option>
                {(applications.data ?? []).map((entry) => (
                  <option key={entry.client_id} value={entry.client_id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-[13px] text-neutral-400">
            {t("auth_admin:audit.filter_from")}
            <Input type="date" value={from} onChange={(changed) => setParam("from", changed.target.value)}/>
          </label>

          <label className="flex flex-col gap-1 text-[13px] text-neutral-400">
            {t("auth_admin:audit.filter_to")}
            <Input type="date" value={to} onChange={(changed) => setParam("to", changed.target.value)}/>
          </label>

          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setParams({})}>
              {t("admin:common.clear_filters")}
            </Button>
          )}
        </div>

        {user && (
          <p className="mb-4 text-[13px] text-neutral-500">
            {t("auth_admin:audit.scoped_to_user")}{" "}
            <Link to={adminRoute.user(user)} className="underline underline-offset-2">
              {rows[0]?.user_email ?? user}
            </Link>
          </p>
        )}

        <SectionState
          resource={entries}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<ClockCounterClockwise size={32}/>}
              title={filtered ? t("auth_admin:audit.no_matches") : t("auth_admin:audit.empty")}
              description={filtered ? t("auth_admin:audit.no_matches_hint") : t("auth_admin:audit.empty_hint")}
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(entry) => entry.id}
            caption={t("auth_admin:audit.title")}
            onRowClick={(entry) => setExpanded((current) => (current === entry.id ? null : entry.id))}
          />

          {/*
            * The payload is free-form JSON the service writes, and its shape differs per event, so
            * it is shown verbatim under the row rather than parsed into fields that would be wrong
            * for most events.
            */}
          {expanded && rows.find((entry) => entry.id === expanded)?.metadata && (
            <pre className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900 px-4 py-3 text-[12px] text-neutral-300">
              {JSON.stringify(rows.find((entry) => entry.id === expanded)?.metadata, null, 2)}
            </pre>
          )}

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            onChange={(next) => setParam("offset", next > 0 ? String(next) : "")}
          />
        </SectionState>
      </Surface>
    </>
  );
};
