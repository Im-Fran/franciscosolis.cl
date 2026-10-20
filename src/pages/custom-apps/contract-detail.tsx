import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {ArrowsClockwise, PencilSimple, Prohibit, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {addDays, dayIn, formatDay, formatMinutes, formatMoney} from "@/lib/custom-apps/format.ts";
import type {AuditEntry, ContractDetail as Contract} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {AuditTrail} from "@/pages/custom-apps/components/audit-trail.tsx";
import {ContractStatusBadge, ExpiringBadge, StateBadge} from "@/pages/custom-apps/components/badges.tsx";
import {RenewDialog, TextDialog} from "@/pages/custom-apps/components/contracts/contract-dialogs.tsx";
import {companyName, contractPeriod} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {CurrentCycleCard} from "@/pages/custom-apps/components/contracts/current-cycle-card.tsx";
import {CyclesPanel} from "@/pages/custom-apps/components/contracts/cycles-panel.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {WorkLogPanel} from "@/pages/custom-apps/components/work-log/work-log-panel.tsx";
import type {WorkLogScope} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

/** The line under each entry of the contract's history, read from what the service recorded. */
const useDescribeHistory = () => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  return useCallback(
    (entry: AuditEntry) => {
      const metadata = entry.metadata ?? {};
      const text = (key: string) => (typeof metadata[key] === "string" && metadata[key] ? (metadata[key] as string) : null);
      switch (entry.event) {
        case "contract.cancelled":
          return text("reason") ? t("contract.history.reason", {reason: text("reason")}) : null;
        case "cycle.billed":
          return text("reference") ? t("contract.history.reference", {reference: text("reference")}) : null;
        case "cycle.closed": {
          const used = typeof metadata.used_minutes === "number" ? formatMinutes(metadata.used_minutes) : null;
          const startsOn = text("starts_on");
          const endsOn = text("ends_on");
          return startsOn && endsOn
            ? t("contract.history.cycle", {
                range: `${formatDay(startsOn, language)} – ${formatDay(addDays(endsOn, -1), language)}`,
                used: used ?? "—",
              })
            : null;
        }
        case "contract.renewed": {
          const after = metadata.after as {ends_on?: string | null} | undefined;
          if (!after || !("ends_on" in after)) return null;
          return after.ends_on ? t("contract.history.renewed_until", {date: formatDay(after.ends_on, language)}) : t("contract.history.renewed_open");
        }
        case "contract.notice_sent":
          return Array.isArray(metadata.recipients) && metadata.recipients.length > 0
            ? t("contract.history.recipients", {recipients: metadata.recipients.join(", ")})
            : null;
        case "contract.lapsed":
          return typeof metadata.state === "string" ? t("contract.history.lapsed", {state: t(`states.${metadata.state}`, {defaultValue: metadata.state})}) : null;
        default:
          return null;
      }
    },
    [language, t],
  );
};

/**
 * One contract: what it covers and costs, the cycle running today, every cycle before it, the work
 * logged against it, and its lifecycle — the notice sent before its end, its lapse, its cancellation.
 *
 * What can be done follows its status, as the service enforces it: a cancelled contract is read
 * only (renewing one is refused — a new contract is created instead), and deleting is only possible
 * while nothing was ever logged or closed against it; otherwise the service answers 409 and the
 * dialog says to cancel instead.
 */
export const ContractDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const language = i18n.language;
  const {contractId = ""} = useParams<{contractId: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const {timezone} = useServiceVocabulary();
  const today = dayIn(new Date(), timezone);
  const describeHistory = useDescribeHistory();

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.contracts.get(contractId, signal), [contractId]));
  const [contract, setContract] = useState<Contract | null>(null);
  const [cyclesVersion, setCyclesVersion] = useState(0);
  useEffect(() => {
    if (record.data) setContract(record.data);
  }, [record.data]);

  const [renewing, setRenewing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const renew = useMutation(useCallback((endsOn: string | null) => customAppsApi.contracts.renew(contractId, endsOn), [contractId]));
  const cancel = useMutation(useCallback((reason: string | null) => customAppsApi.contracts.cancel(contractId, reason), [contractId]));
  const remove = useMutation(useCallback(() => customAppsApi.contracts.remove(contractId), [contractId]));

  const current = contract && contract.id === contractId ? contract : null;
  const reload = record.reload;

  /* A work log entry moves the current cycle; a cycle closed or billed moves the history beside it. */
  const refresh = useCallback(() => {
    reload();
    setCyclesVersion((value) => value + 1);
  }, [reload]);

  const scope = useMemo<WorkLogScope | null>(() => (current ? {kind: "contract", contract: current} : null), [current]);

  const back = {to: customAppsRoute.contracts, label: t("custom_apps:contracts.back")};

  if (!current || !scope) {
    return (
      <>
        <PageHeader title={t("custom_apps:contract.loading_title")} back={back} />
        <Panel title={t("custom_apps:contract.details")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const take = (next: Contract) => {
    setContract(next);
    setCyclesVersion((value) => value + 1);
  };

  const confirmRenew = async (endsOn: string | null) => {
    const outcome = await renew.run(endsOn);
    if (!outcome.ok) return;
    take(outcome.data);
    setRenewing(false);
    notify(t("custom_apps:contract.renewed"));
  };

  const confirmCancel = async (reason: string | null) => {
    const outcome = await cancel.run(reason);
    if (!outcome.ok) return;
    take(outcome.data);
    setCancelling(false);
    notify(t("custom_apps:contract.cancelled"));
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(customAppsRoute.contracts, {replace: true});
  };

  const cancelled = current.status === "cancelled";
  const graceEnds = current.ends_on && current.grace_days > 0 ? addDays(current.ends_on, current.grace_days) : null;
  const company = companyName(current.company);

  return (
    <>
      <PageHeader
        title={current.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ContractStatusBadge value={current.status} />
            {current.expiring && <ExpiringBadge daysLeft={current.days_left} />}
            {company && (
              <>
                <span className="text-neutral-700" aria-hidden="true">·</span>
                <Link to={customAppsRoute.company(current.company_id)} className="hover:text-text hover:underline">
                  {company}
                </Link>
              </>
            )}
          </span>
        }
        back={back}
        actions={
          <>
            {!cancelled && (
              <>
                <Button variant="secondary" asChild>
                  <Link to={customAppsRoute.contractEdit(current.id)}>
                    <PencilSimple size={16} /> {t("custom_apps:contract.edit")}
                  </Link>
                </Button>
                <Button
                  onClick={() => {
                    renew.reset();
                    setRenewing(true);
                  }}
                >
                  <ArrowsClockwise size={16} /> {t("custom_apps:contract.renew")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    cancel.reset();
                    setCancelling(true);
                  }}
                  className="border-red-500/50 text-red-300 fs-ripple-danger"
                >
                  <Prohibit size={16} /> {t("custom_apps:contract.cancel")}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                remove.reset();
                setAskDelete(true);
              }}
              className="text-red-300"
            >
              <Trash size={16} /> {t("admin:common.delete")}
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {cancelled && (
          <Alert tone="error" title={t("custom_apps:contract.cancelled_title")}>
            {t("custom_apps:contract.cancelled_body", {
              date: formatDateTime(current.cancelled_at, language) ?? "—",
              by: current.cancelled_by ?? t("custom_apps:audit.system"),
            })}
            {current.cancel_reason && (
              <span className="mt-1 block">{t("custom_apps:contract.cancel_reason_value", {reason: current.cancel_reason})}</span>
            )}
          </Alert>
        )}
        {current.status === "grace" && (
          <Alert tone="error" title={t("custom_apps:contract.grace_title")}>
            {graceEnds
              ? t("custom_apps:contract.grace_body", {date: formatDay(graceEnds, language)})
              : t("custom_apps:contract.grace_body_short")}
          </Alert>
        )}
        {current.status === "ended" && (
          <Alert tone="info" title={t("custom_apps:contract.ended_title")}>
            {t("custom_apps:contract.ended_body")}
          </Alert>
        )}
        {current.expiring && (
          <Alert tone="info" title={t("custom_apps:contract.expiring_title", {count: current.days_left ?? 0})}>
            {current.notice_sent_at
              ? t("custom_apps:contract.expiring_notified", {date: formatDateTime(current.notice_sent_at, language)})
              : t("custom_apps:contract.expiring_body")}
          </Alert>
        )}

        <Panel title={t("custom_apps:contract.details")}>
          <DetailList>
            <Detail label={t("custom_apps:contract_editor.fields.company")}>
              <Link to={customAppsRoute.company(current.company_id)} className="hover:underline">
                {company ?? current.company_id}
              </Link>
            </Detail>
            <Detail label={t("custom_apps:contract_editor.fields.amount")}>
              {formatMoney(current.amount, current.currency, language)}
              <span className="text-neutral-500"> · {t(`custom_apps:billing_periods.${current.billing_period}`, {defaultValue: current.billing_period})}</span>
            </Detail>
            <Detail label={t("custom_apps:contract.period")}>
              {contractPeriod(current, t, language)}
              {current.days_left !== null && current.status === "active" && (
                <span className="block text-[12px] text-neutral-500">{t("custom_apps:contracts.days_left", {count: current.days_left})}</span>
              )}
            </Detail>
            <Detail label={t("custom_apps:contract.renewal")}>
              {current.auto_renew ? t("custom_apps:contracts.auto_renews", {count: current.renewal_months}) : t("custom_apps:contract.no_auto_renew")}
            </Detail>
            <Detail label={t("custom_apps:contract_editor.fields.notice_days")}>{t("custom_apps:contract.days", {count: current.notice_days})}</Detail>
            <Detail label={t("custom_apps:contract.hours_plan")}>
              {t("custom_apps:contract.hours_plan_value", {
                time: formatMinutes(current.included_minutes),
                period: t(`custom_apps:cycle_periods_per.${current.cycle_period}`, {defaultValue: current.cycle_period}),
              })}
            </Detail>
            <Detail label={t("custom_apps:contract.overage_rate")}>
              {current.overage_rate > 0
                ? t("custom_apps:contract.per_hour", {amount: formatMoney(current.overage_rate, current.currency, language)})
                : t("custom_apps:contract.no_overage_rate")}
            </Detail>
            <Detail label={t("custom_apps:contract.rollover")}>
              {current.rollover_enabled
                ? [
                    t("custom_apps:contract.rollover_on"),
                    current.rollover_max_minutes !== null && t("custom_apps:contract.rollover_cap", {time: formatMinutes(current.rollover_max_minutes)}),
                    current.rollover_max_cycles !== null && t("custom_apps:contract.rollover_cycles", {count: current.rollover_max_cycles}),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("custom_apps:contract.rollover_off")}
            </Detail>
            <Detail label={t("custom_apps:contract_editor.fields.security_patch_days")}>
              {current.security_patch_days !== undefined ? t("custom_apps:contract.days", {count: current.security_patch_days}) : null}
            </Detail>
            <Detail label={t("custom_apps:contract.grace")}>
              {current.grace_days > 0
                ? [
                    t("custom_apps:contract.days", {count: current.grace_days}),
                    current.grace_allows.length > 0
                      ? t("custom_apps:contract.grace_allows", {
                          list: current.grace_allows.map((value) => t(`custom_apps:grace_allowances.${value}`, {defaultValue: value})).join(", "),
                        })
                      : t("custom_apps:contract.grace_allows_nothing"),
                  ].join(" · ")
                : t("custom_apps:contract.no_grace")}
            </Detail>
          </DetailList>

          <div className="mt-6 border-t border-neutral-800 pt-5">
            <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:contract.apps")}</p>
            {current.apps.length === 0 ? (
              <p className="text-[13px] text-neutral-500">{t("custom_apps:contract.apps_none")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {current.apps.map((app) => (
                  <li key={app.id}>
                    <Link
                      to={customAppsRoute.app(app.id)}
                      className="flex items-center gap-2 rounded-[var(--radius-md)] border border-neutral-800 px-3 py-1.5 text-[13px] text-neutral-300 transition-colors hover:border-neutral-700 hover:text-text"
                    >
                      {app.name}
                      <StateBadge state={app.state} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {current.grace_message && (
            <div className="mt-5 border-t border-neutral-800 pt-5">
              <p className="mb-1 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:contract_editor.fields.grace_message")}</p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-neutral-300">{current.grace_message}</p>
            </div>
          )}
        </Panel>

        <CurrentCycleCard contract={current} />

        <CyclesPanel contract={current} today={today} version={cyclesVersion} onChanged={reload} />

        <WorkLogPanel scope={scope} onChanged={refresh} description={t("custom_apps:work_log.description_contract")} />

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title={t("custom_apps:contract.lifecycle")} description={t("custom_apps:contract.lifecycle_hint")}>
            <DetailList className="lg:grid-cols-2">
              <Detail label={t("custom_apps:contract.notice_sent_at")}>
                {current.notice_sent_at ? formatDateTime(current.notice_sent_at, language) : t("custom_apps:contract.not_yet")}
              </Detail>
              <Detail label={t("custom_apps:contract.lapsed_at")}>
                {current.lapsed_at ? formatDateTime(current.lapsed_at, language) : t("custom_apps:contract.not_yet")}
              </Detail>
              <Detail label={t("custom_apps:contract.cancelled_at")}>
                {current.cancelled_at &&
                  `${formatDateTime(current.cancelled_at, language)}${current.cancelled_by ? ` · ${current.cancelled_by}` : ""}`}
              </Detail>
              <Detail label={t("custom_apps:summary.created")}>
                {formatDateTime(current.created_at, language)}
                {current.created_by && <span className="text-neutral-500"> · {current.created_by}</span>}
              </Detail>
              <Detail label={t("custom_apps:summary.updated")}>
                {formatDateTime(current.updated_at, language)}
                {current.updated_by && <span className="text-neutral-500"> · {current.updated_by}</span>}
              </Detail>
            </DetailList>
            {current.notes && (
              <div className="mt-6 border-t border-neutral-800 pt-5">
                <p className="mb-1 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:fields.notes")}</p>
                <p className="text-sm leading-relaxed whitespace-pre-line text-neutral-300">{current.notes}</p>
              </div>
            )}
          </Panel>

          <AuditTrail
            title={t("custom_apps:contract.history_title")}
            description={t("custom_apps:contract.history_description")}
            query={{resource_type: "contract", resource_id: current.id}}
            describe={describeHistory}
            emptyTitle={t("custom_apps:contract.history_empty")}
          />
        </div>
      </div>

      <RenewDialog
        open={renewing}
        contract={current}
        today={today}
        pending={renew.pending}
        error={renew.error}
        onConfirm={(endsOn) => void confirmRenew(endsOn)}
        onClose={() => setRenewing(false)}
      />

      <TextDialog
        open={cancelling}
        title={t("custom_apps:contract.cancel_title", {name: current.name})}
        body={t("custom_apps:contract.cancel_body")}
        label={t("custom_apps:contract.cancel_reason")}
        hint={t("custom_apps:contract.cancel_reason_hint")}
        help={help.field("contract.help.cancel_reason")}
        formHelp={help.form("contract.cancel_form_help")}
        confirmLabel={t("custom_apps:contract.cancel")}
        multiline
        danger
        pending={cancel.pending}
        error={cancel.error}
        onConfirm={(reason) => void confirmCancel(reason)}
        onClose={() => setCancelling(false)}
      />

      <ConfirmDialog
        open={askDelete}
        title={t("custom_apps:contract.delete_title")}
        body={t("custom_apps:contract.delete_body", {name: current.name})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.status === 409 ? t("custom_apps:contract.delete_refused") : remove.error}
      />
    </>
  );
};
