import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowSquareOut, Lifebuoy, LockSimple, Notebook, PencilSimple, Plus, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatDay, formatMinutes} from "@/lib/custom-apps/format.ts";
import type {WorkKind, WorkLogEntry} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {WorkLogDialog} from "@/pages/custom-apps/components/work-log/work-log-dialog.tsx";
import type {WorkLogPreset} from "@/pages/custom-apps/components/work-log/work-log-dialog.tsx";
import type {WorkLogScope} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";

const PAGE_SIZE = 25;

/**
 * The work log (bitácora): what was done for a client, on which day, for how long — of a company, an
 * app or a contract. The total under the title is the service's sum over everything the filters
 * match, not over the loaded page, which is the figure a cycle's balance is made of.
 *
 * An entry inside a closed cycle is shown locked: its cycle's balance was computed once when it
 * closed and the next cycle's carried hours derive from it, so the service refuses to touch it.
 *
 * `onChanged` lets the page around it refresh what the entry moved — a contract's current cycle.
 *
 * `ticket` narrows it to the work logged against one support ticket, and a new entry starts linked
 * to that ticket as support work — the ticket's own page shows its time this way. Elsewhere an entry
 * linked to a ticket says so, and links to it.
 */
export const WorkLogPanel = ({
  scope,
  ticket,
  onChanged,
  title,
  description,
}: {
  scope: WorkLogScope;
  ticket?: {id: string; number: number};
  onChanged?: () => void;
  title?: string;
  description?: string;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const {notify} = useToast();
  const {workKinds} = useServiceVocabulary();
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<{entry: WorkLogEntry | null} | null>(null);
  const [deleting, setDeleting] = useState<WorkLogEntry | null>(null);

  const appId = scope.kind === "app" ? scope.appId : "";
  const contractId = scope.kind === "contract" ? scope.contract.id : "";
  const companyId = scope.kind === "company" ? scope.companyId : "";
  const ticketId = ticket?.id ?? "";
  const ticketNumber = ticket?.number ?? 0;
  /* Built from primitives: the dialog resets its form whenever the preset changes identity. */
  const preset = useMemo<WorkLogPreset | undefined>(
    () => (ticketId ? {ticketId, ticketNumber, kind: "support"} : undefined),
    [ticketId, ticketNumber],
  );

  const entries = useResource(
    useCallback(
      (signal: AbortSignal) => {
        const filters = {
          kind: (kind || undefined) as WorkKind | undefined,
          from: from || undefined,
          to: to || undefined,
          ticket_id: ticketId || undefined,
          limit: PAGE_SIZE,
          offset,
        };
        if (appId) return customAppsApi.workLogs.listForApp(appId, filters, signal);
        return customAppsApi.workLogs.list({...filters, contract_id: contractId || undefined, company_id: companyId || undefined}, signal);
      },
      [appId, contractId, companyId, ticketId, kind, from, to, offset],
    ),
  );

  const remove = useMutation(useCallback((id: string) => customAppsApi.workLogs.remove(id), []));
  const resetRemove = remove.reset;

  const rows = entries.data?.data ?? [];
  const total = entries.data?.pagination.total ?? 0;
  const totalMinutes = entries.data?.totals?.minutes ?? 0;
  const filtered = Boolean(kind || from || to);

  const filter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  const changed = useCallback(() => {
    entries.reload();
    onChanged?.();
  }, [entries, onChanged]);

  const confirmDelete = async () => {
    if (!deleting) return;
    const outcome = await remove.run(deleting.id);
    if (!outcome.ok) return;
    setDeleting(null);
    notify(t("admin:common.deleted"));
    changed();
  };

  const columns = useMemo<Column<WorkLogEntry>[]>(() => {
    const list: Column<WorkLogEntry>[] = [
      {
        key: "day",
        header: t("custom_apps:work_log.columns.day"),
        className: "w-32 whitespace-nowrap",
        cell: (row) => formatDay(row.occurred_on, language),
      },
      {
        key: "time",
        header: t("custom_apps:work_log.columns.time"),
        className: "w-28 whitespace-nowrap tabular-nums",
        cell: (row) => <span className="text-text">{formatMinutes(row.minutes)}</span>,
      },
      {
        key: "work",
        header: t("custom_apps:work_log.columns.work"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
              <span className="rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 px-1.5 py-0.5 text-[11px] text-neutral-300">
                {t(`custom_apps:work_kinds.${row.kind}`, {defaultValue: row.kind})}
              </span>
              {scope.kind !== "app" && <span>{row.app_name ?? t("custom_apps:work_log.whole_company")}</span>}
              {scope.kind === "app" || scope.kind === "company" ? (
                row.contract_id ? (
                  <Link to={customAppsRoute.contract(row.contract_id)} className="hover:text-text hover:underline" onClick={(event) => event.stopPropagation()}>
                    {row.contract_name ?? t("custom_apps:work_log.contract")}
                  </Link>
                ) : (
                  <span className="italic">{t("custom_apps:work_log.no_contract")}</span>
                )
              ) : null}
              {row.ticket_id && row.ticket_id !== ticketId && (
                <Link
                  to={customAppsRoute.ticket(row.ticket_id)}
                  className="inline-flex items-center gap-1 hover:text-text hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Lifebuoy size={12} aria-hidden="true" />
                  {row.ticket_number ? t("custom_apps:work_log.ticket", {number: row.ticket_number}) : t("custom_apps:work_log.fields.ticket")}
                </Link>
              )}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-neutral-300">{row.description}</p>
            {(row.link_url || row.created_by) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-neutral-500">
                {row.link_url && (
                  <a href={row.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all hover:text-text hover:underline">
                    <ArrowSquareOut size={12} aria-hidden="true" /> {t("custom_apps:work_log.open_link")}
                  </a>
                )}
                {row.created_by && <span>{row.created_by}</span>}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("custom_apps:work_log.columns.actions")}</span>,
        className: "w-24 text-right",
        cell: (row) =>
          row.editable ? (
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setEditing({entry: row})}
                aria-label={t("custom_apps:work_log.edit_aria", {day: formatDay(row.occurred_on, language)})}
              >
                <PencilSimple size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-red-300"
                onClick={() => {
                  resetRemove();
                  setDeleting(row);
                }}
                aria-label={t("custom_apps:work_log.delete_aria", {day: formatDay(row.occurred_on, language)})}
              >
                <Trash size={14} />
              </Button>
            </span>
          ) : (
            <span className="inline-flex justify-end text-neutral-600" title={t("custom_apps:work_log.locked")}>
              <LockSimple size={14} aria-label={t("custom_apps:work_log.locked")} />
            </span>
          ),
      },
    ];
    return list;
  }, [language, resetRemove, scope.kind, ticketId, t]);

  return (
    <Panel
      title={title ?? t("custom_apps:work_log.title")}
      description={
        entries.data
          ? t("custom_apps:work_log.summary", {count: total, time: formatMinutes(totalMinutes)})
          : (description ?? t("custom_apps:work_log.description"))
      }
      action={
        <Button size="sm" onClick={() => setEditing({entry: null})}>
          <Plus size={14} /> {t("custom_apps:work_log.create")}
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label={t("custom_apps:work_log.filters.kind")} htmlFor={`work-log-kind-${scope.kind}`}>
          <Select
            id={`work-log-kind-${scope.kind}`}
            value={kind}
            onChange={(event) => filter(() => setKind(event.target.value))}
            className="h-9 w-auto min-w-[10rem] text-[13px]"
          >
            <option value="">{t("custom_apps:work_log.filters.any_kind")}</option>
            {workKinds.map((value) => (
              <option key={value} value={value}>
                {t(`custom_apps:work_kinds.${value}`, {defaultValue: value})}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("custom_apps:work_log.filters.from")} htmlFor={`work-log-from-${scope.kind}`}>
          <Input
            id={`work-log-from-${scope.kind}`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => filter(() => setFrom(event.target.value))}
            className="h-9 w-auto text-[13px]"
          />
        </Field>
        <Field label={t("custom_apps:work_log.filters.to")} htmlFor={`work-log-to-${scope.kind}`}>
          <Input
            id={`work-log-to-${scope.kind}`}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => filter(() => setTo(event.target.value))}
            className="h-9 w-auto text-[13px]"
          />
        </Field>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              filter(() => {
                setKind("");
                setFrom("");
                setTo("");
              })
            }
          >
            {t("admin:common.clear_filters")}
          </Button>
        )}
      </div>

      <PanelState loading={entries.loading && !entries.data} error={entries.error} onRetry={entries.reload} ns="admin">
        {rows.length === 0 ? (
          filtered ? (
            <p className="py-4 text-sm text-neutral-500">{t("custom_apps:work_log.no_matches")}</p>
          ) : (
            <EmptyState
              icon={<Notebook size={28} />}
              title={t("custom_apps:work_log.empty")}
              description={t("custom_apps:work_log.empty_description")}
            />
          )
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            caption={title ?? t("custom_apps:work_log.title")}
            className={entries.loading ? "opacity-60 transition-opacity" : undefined}
          />
        )}
        <Pagination offset={offset} limit={PAGE_SIZE} count={rows.length} total={total} onChange={setOffset} disabled={entries.loading} />
      </PanelState>

      {editing && (
        <WorkLogDialog
          open
          scope={scope}
          entry={editing.entry}
          preset={preset}
          onClose={() => setEditing(null)}
          onSaved={() => {
            notify(editing.entry ? t("admin:common.saved") : t("custom_apps:work_log.created"));
            setEditing(null);
            changed();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("custom_apps:work_log.delete_title")}
        body={
          deleting
            ? t("custom_apps:work_log.delete_body", {day: formatDay(deleting.occurred_on, language), time: formatMinutes(deleting.minutes)})
            : ""
        }
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        pending={remove.pending}
        error={remove.status === 409 ? t("custom_apps:work_log.errors.closed_cycle") : remove.error}
      />
    </Panel>
  );
};
