import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowSquareOut, Calendar, ListBullets, LockSimple, Receipt} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatDay, formatMinutes, formatMoney} from "@/lib/custom-apps/format.ts";
import type {Contract, Cycle} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {CycleStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {TextDialog} from "@/pages/custom-apps/components/contracts/contract-dialogs.tsx";
import {cycleEnded, cycleRange} from "@/pages/custom-apps/components/contracts/contract-format.ts";

const PAGE_SIZE = 12;

/** Every entry filed under one cycle, read through `GET /cycles/:id`. */
const CycleWorkLog = ({cycleId, onClose}: {cycleId: string; onClose: () => void}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const cycle = useResource(useCallback((signal: AbortSignal) => customAppsApi.cycles.get(cycleId, signal), [cycleId]));
  const data = cycle.data;

  return (
    <Modal open onClose={onClose} title={data ? t("custom_apps:cycle.work_log_title", {range: cycleRange(data, language)}) : t("custom_apps:cycle.work_log")} className="max-w-2xl">
      <PanelState loading={cycle.loading} error={cycle.error} onRetry={cycle.reload} ns="admin">
        {data && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-neutral-400">
              {t("custom_apps:cycle.work_log_summary", {
                count: data.work_logs.length,
                used: formatMinutes(data.used_minutes),
                available: formatMinutes(data.available_minutes),
              })}
            </p>
            {data.work_logs.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("custom_apps:cycle.work_log_empty")}</p>
            ) : (
              <ul>
                {data.work_logs.map((entry) => (
                  <li key={entry.id} className="border-b border-neutral-800/70 py-2.5 last:border-0">
                    <p className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                      <span className="text-neutral-300">
                        {formatDay(entry.occurred_on, language)} · {t(`custom_apps:work_kinds.${entry.kind}`, {defaultValue: entry.kind})}
                        {entry.app_name && <span className="text-neutral-500"> · {entry.app_name}</span>}
                        {entry.ticket_id && (
                          <Link to={customAppsRoute.ticket(entry.ticket_id)} className="text-neutral-500 hover:text-text hover:underline">
                            {" · "}
                            {entry.ticket_number ? t("custom_apps:work_log.ticket", {number: entry.ticket_number}) : t("custom_apps:work_log.fields.ticket")}
                          </Link>
                        )}
                      </span>
                      <span className="tabular-nums text-text">{formatMinutes(entry.minutes)}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] whitespace-pre-line text-neutral-400">{entry.description}</p>
                    {entry.link_url && (
                      <a
                        href={entry.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-text hover:underline"
                      >
                        <ArrowSquareOut size={12} aria-hidden="true" /> {t("custom_apps:work_log.open_link")}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PanelState>
    </Modal>
  );
};

/**
 * The contract's cycles, newest first, with the two things done to one by hand: **closing** it once
 * its period is over (the cron closes it on its own after that; closing just does it now) and
 * **marking it billed** once its overage was invoiced, with the invoice's reference.
 *
 * A closed cycle's figures are final — they are what the next cycle's carried hours derive from — so
 * neither action is offered on a cycle whose status no longer allows it; the service refuses those
 * with a 409 anyway.
 */
export const CyclesPanel = ({
  contract,
  today,
  version,
  onChanged,
}: {
  contract: Pick<Contract, "id" | "currency">;
  today: string;
  /** Bumped by the page when something it did may have moved a cycle. */
  version: number;
  onChanged: () => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const {notify} = useToast();
  const [offset, setOffset] = useState(0);
  const [closing, setClosing] = useState<Cycle | null>(null);
  const [billing, setBilling] = useState<Cycle | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const contractId = contract.id;
  const cycles = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.contracts.cycles(contractId, {limit: PAGE_SIZE, offset}, signal),
      /* `version` is listed on purpose: bumping it is how the page asks for a reload. */
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [contractId, offset, version],
    ),
  );

  const close = useMutation(useCallback((id: string) => customAppsApi.cycles.close(id), []));
  const bill = useMutation(useCallback((id: string, reference: string | null) => customAppsApi.cycles.bill(id, reference), []));
  const resetClose = close.reset;
  const resetBill = bill.reset;

  const rows = cycles.data?.data ?? [];

  const confirmClose = async () => {
    if (!closing) return;
    const outcome = await close.run(closing.id);
    if (!outcome.ok) return;
    setClosing(null);
    notify(t("custom_apps:cycle.closed_toast"));
    cycles.reload();
    onChanged();
  };

  const confirmBill = async (reference: string | null) => {
    if (!billing) return;
    const outcome = await bill.run(billing.id, reference);
    if (!outcome.ok) return;
    setBilling(null);
    notify(t("custom_apps:cycle.billed_toast"));
    cycles.reload();
    onChanged();
  };

  const columns = useMemo<Column<Cycle>[]>(
    () => [
      {
        key: "period",
        header: t("custom_apps:cycle.columns.period"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="text-sm whitespace-nowrap text-text">{cycleRange(row, language)}</p>
            <p className="mt-0.5">
              <CycleStatusBadge value={row.status} />
            </p>
          </div>
        ),
      },
      {
        key: "hours",
        header: t("custom_apps:cycle.columns.hours"),
        className: "w-44 tabular-nums",
        cell: (row) => (
          <span className="flex flex-col">
            <span className="text-text">
              {formatMinutes(row.used_minutes)} <span className="text-neutral-500">/ {formatMinutes(row.available_minutes)}</span>
            </span>
            {row.carried_minutes > 0 && (
              <span className="text-[12px] text-neutral-500">{t("custom_apps:cycle.carried_short", {time: formatMinutes(row.carried_minutes)})}</span>
            )}
            {(row.expired_minutes ?? 0) > 0 && (
              <span className="text-[12px] text-neutral-500">{t("custom_apps:cycle.expired_short", {time: formatMinutes(row.expired_minutes)})}</span>
            )}
          </span>
        ),
      },
      {
        key: "overage",
        header: t("custom_apps:cycle.columns.overage"),
        className: "w-40 tabular-nums",
        cell: (row) =>
          row.overage_minutes > 0 ? (
            <span className="flex flex-col text-red-300">
              <span>{formatMinutes(row.overage_minutes)}</span>
              {row.overage_amount !== null && (
                <span className="text-[12px]">
                  {formatMoney(row.overage_amount, contract.currency, language)}
                  {row.status === "open" && <span className="text-neutral-500"> · {t("custom_apps:cycle.estimate")}</span>}
                </span>
              )}
            </span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
      },
      {
        key: "closing",
        header: t("custom_apps:cycle.columns.closing"),
        className: "w-48",
        hideBelowLg: true,
        cell: (row) =>
          row.status === "billed" ? (
            <span className="flex flex-col text-[12px] text-neutral-400">
              <span>{t("custom_apps:cycle.billed_on", {date: formatDateTime(row.billed_at, language)})}</span>
              {row.billing_reference && <span className="font-mono text-neutral-300">{row.billing_reference}</span>}
              {row.billed_by && <span className="text-neutral-500">{row.billed_by}</span>}
            </span>
          ) : row.status === "closed" ? (
            <span className="flex flex-col text-[12px] text-neutral-400">
              <span>{t("custom_apps:cycle.closed_on", {date: formatDateTime(row.closed_at, language)})}</span>
              <span className="text-neutral-500">{row.closed_by ?? t("custom_apps:audit.automatic")}</span>
            </span>
          ) : cycleEnded(row, today) ? (
            <span className="text-[12px] text-amber-300">{t("custom_apps:cycle.ended_open")}</span>
          ) : (
            <span className="text-[12px] text-neutral-500">{t("custom_apps:cycle.running")}</span>
          ),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("custom_apps:cycle.columns.actions")}</span>,
        className: "w-56 text-right",
        cell: (row) => (
          <span className="flex flex-wrap justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setViewing(row.id)}>
              <ListBullets size={14} /> {t("custom_apps:cycle.work_log")}
            </Button>
            {row.status === "open" && cycleEnded(row, today) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  resetClose();
                  setClosing(row);
                }}
              >
                <LockSimple size={14} /> {t("custom_apps:cycle.close")}
              </Button>
            )}
            {row.status === "closed" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  resetBill();
                  setBilling(row);
                }}
              >
                <Receipt size={14} /> {t("custom_apps:cycle.bill")}
              </Button>
            )}
          </span>
        ),
      },
    ],
    [contract.currency, language, resetBill, resetClose, t, today],
  );

  return (
    <Panel
      title={t("custom_apps:cycle.history_title")}
      description={cycles.data ? t("custom_apps:cycle.count", {count: cycles.data.pagination.total}) : t("custom_apps:cycle.history_description")}
    >
      <PanelState loading={cycles.loading && !cycles.data} error={cycles.error} onRetry={cycles.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={<Calendar size={28} />} title={t("custom_apps:cycle.history_empty")} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            caption={t("custom_apps:cycle.history_title")}
            className={cycles.loading ? "opacity-60 transition-opacity" : undefined}
          />
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={cycles.data?.pagination.total}
          onChange={setOffset}
          disabled={cycles.loading}
        />
      </PanelState>

      <ConfirmDialog
        open={closing !== null}
        title={t("custom_apps:cycle.close_title")}
        body={closing ? t("custom_apps:cycle.close_body", {range: cycleRange(closing, language)}) : ""}
        confirmLabel={t("custom_apps:cycle.close")}
        onConfirm={() => void confirmClose()}
        onClose={() => setClosing(null)}
        pending={close.pending}
        error={close.error}
      />

      <TextDialog
        open={billing !== null}
        title={t("custom_apps:cycle.bill_title")}
        body={
          billing
            ? billing.overage_minutes > 0 && billing.overage_amount !== null
              ? t("custom_apps:cycle.bill_body_overage", {
                  range: cycleRange(billing, language),
                  amount: formatMoney(billing.overage_amount, contract.currency, language),
                  time: formatMinutes(billing.overage_minutes),
                })
              : t("custom_apps:cycle.bill_body", {range: cycleRange(billing, language)})
            : ""
        }
        label={t("custom_apps:cycle.reference")}
        hint={t("custom_apps:cycle.reference_hint")}
        confirmLabel={t("custom_apps:cycle.bill")}
        pending={bill.pending}
        error={bill.error}
        onConfirm={(reference) => void confirmBill(reference)}
        onClose={() => setBilling(null)}
      />

      {viewing && <CycleWorkLog cycleId={viewing} onClose={() => setViewing(null)} />}
    </Panel>
  );
};
