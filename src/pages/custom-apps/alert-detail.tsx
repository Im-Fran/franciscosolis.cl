import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {CheckCircle, Checks} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {formatAlertValue, isContractKind} from "@/lib/custom-apps/alerts.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatMinutes} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {AlertEntry} from "@/lib/custom-apps/types.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {AlertKindIcon} from "@/pages/custom-apps/components/alerts/alert-kind.tsx";
import {AlertStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const REFRESH_MS = 30_000;
const NOTE_MAX = 500;

/**
 * One alert — where the notification centre's links land, at `/custom-apps/alerts/:id`.
 *
 * Acknowledging says "somebody is on it" and keeps it in the inbox; resolving takes it out. Neither
 * changes the condition itself: if what triggered the alert still holds at the next evaluation, the
 * service opens it again, which the resolve dialog says before it is clicked rather than after.
 */
export const AlertDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {alertId = ""} = useParams<{alertId: string}>();
  const {notify} = useToast();
  const language = i18n.language;

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.alerts.get(alertId, signal), [alertId]));
  useAutoRefresh(record.reload, REFRESH_MS);
  const [alert, setAlert] = useState<AlertEntry | null>(null);
  useEffect(() => {
    if (record.data) setAlert(record.data);
  }, [record.data]);

  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const ack = useMutation(useCallback(() => customAppsApi.alerts.acknowledge(alertId), [alertId]));
  const resolve = useMutation(useCallback((text: string | null) => customAppsApi.alerts.resolve(alertId, text), [alertId]));

  const current = alert && alert.id === alertId ? alert : null;
  const back = {to: customAppsRoute.alerts(), label: t("custom_apps:alerts.back")};

  if (!current) {
    return (
      <>
        <PageHeader title={t("custom_apps:alerts.loading_title")} back={back} />
        <Panel title={t("custom_apps:alerts.details")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const acknowledge = async () => {
    const outcome = await ack.run();
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    setAlert(outcome.data);
    notify(t("custom_apps:alerts.acknowledged"));
  };

  const submitResolve = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await resolve.run(orNull(note));
    if (!outcome.ok) return;
    setAlert(outcome.data);
    setResolving(false);
    setNote("");
    notify(t("custom_apps:alerts.resolved"));
  };

  const value = formatAlertValue(current.kind, current.value, language);
  const threshold = formatAlertValue(current.kind, current.threshold, language);
  const details = current.details && Object.keys(current.details).length > 0 ? JSON.stringify(current.details, null, 2) : null;
  const kindLabel = t(`custom_apps:alert_kinds.${current.kind}`, {defaultValue: current.kind});
  /* The contract kinds are about a contract, which has a page of its own; the details name it. */
  const detail = (key: string) => {
    const raw = current.details?.[key];
    return typeof raw === "string" || typeof raw === "number" ? raw : null;
  };
  const contractId = isContractKind(current.kind) ? detail("contract_id") : null;
  const companyName = detail("company_name");
  const availableMinutes = detail("available_minutes");
  const usedMinutes = detail("used_minutes");

  return (
    <>
      <PageHeader
        title={current.subject_name ? `${kindLabel} · ${current.subject_name}` : kindLabel}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AlertKindIcon kind={current.kind} size={16} />
            <AlertStatusBadge value={current.status} />
            {current.app_id && current.app_name && (
              <Link to={customAppsRoute.app(current.app_id)} className="hover:text-text hover:underline">
                {current.app_name}
              </Link>
            )}
          </span>
        }
        back={back}
        actions={
          <>
            {current.status === "open" && (
              <Button variant="secondary" onClick={() => void acknowledge()} disabled={ack.pending}>
                {ack.pending ? <Spinner size={16} /> : <Checks size={16} />}
                {t("custom_apps:alerts.acknowledge")}
              </Button>
            )}
            {current.status !== "resolved" && (
              <Button
                onClick={() => {
                  resolve.reset();
                  setResolving(true);
                }}
              >
                <CheckCircle size={16} /> {t("custom_apps:alerts.resolve")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        {current.status === "resolved" && (
          <Alert tone="success" title={t("custom_apps:alerts.resolved_title")}>
            {t("custom_apps:alerts.resolved_body", {
              date: formatDateTime(current.resolved_at, language) ?? "—",
              by: current.resolved_by ?? t("custom_apps:audit.system"),
            })}
          </Alert>
        )}

        <Panel title={t("custom_apps:alerts.details")} description={t(`custom_apps:alert_kinds_hint.${current.kind}`, {defaultValue: ""}) || undefined}>
          <DetailList>
            <Detail label={t("custom_apps:alerts.value")}>
              {value && (
                <span className="text-text">
                  {value}
                  <span className="text-neutral-500"> {t("custom_apps:alerts.threshold_short", {threshold: threshold ?? "—"})}</span>
                </span>
              )}
            </Detail>
            <Detail label={t("custom_apps:alerts.subject")}>
              {contractId ? (
                <Link to={customAppsRoute.contract(String(contractId))} className="hover:underline">
                  {current.subject_name || detail("contract_name") || t("custom_apps:alerts.open_contract")}
                  {companyName && <span className="text-neutral-500"> · {companyName}</span>}
                </Link>
              ) : current.installation_id ? (
                <Link to={customAppsRoute.installation(current.installation_id)} className="hover:underline">
                  {current.subject_name ?? current.installation_id}
                </Link>
              ) : current.app_id ? (
                <Link to={customAppsRoute.app(current.app_id)} className="hover:underline">
                  {current.subject_name ?? current.app_name ?? current.app_id}
                </Link>
              ) : (
                current.subject_name
              )}
            </Detail>
            {contractId && typeof availableMinutes === "number" && typeof usedMinutes === "number" && (
              <Detail label={t("custom_apps:alerts.cycle_usage")}>
                {t("custom_apps:alerts.cycle_usage_value", {
                  used: formatMinutes(usedMinutes),
                  available: formatMinutes(availableMinutes),
                })}
              </Detail>
            )}
            <Detail label={t("custom_apps:alerts.rule")}>
              <Link to={customAppsRoute.alertRules} className="hover:underline">
                {current.rule_name ?? current.rule_id}
              </Link>
            </Detail>
            <Detail label={t("custom_apps:alerts.columns.occurrences")}>{current.occurrences}</Detail>
            <Detail label={t("custom_apps:alerts.opened")}>{formatDateTime(current.opened_at, language)}</Detail>
            <Detail label={t("custom_apps:alerts.columns.last_triggered")}>{formatDateTime(current.last_triggered_at, language)}</Detail>
            <Detail label={t("custom_apps:alerts.acknowledged_at")}>
              {current.acknowledged_at &&
                `${formatDateTime(current.acknowledged_at, language)}${current.acknowledged_by ? ` · ${current.acknowledged_by}` : ""}`}
            </Detail>
            <Detail label={t("custom_apps:alerts.resolved_at")}>
              {current.resolved_at &&
                `${formatDateTime(current.resolved_at, language)}${current.resolved_by ? ` · ${current.resolved_by}` : ""}`}
            </Detail>
            <Detail label={t("custom_apps:alerts.notified_at")}>
              {current.notified_at ? formatDateTime(current.notified_at, language) : t("custom_apps:alerts.not_notified")}
            </Detail>
          </DetailList>
          {details && (
            <div className="mt-6 border-t border-neutral-800 pt-5">
              <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:alerts.details_raw")}</p>
              <pre className="max-h-72 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300">
                {details}
              </pre>
            </div>
          )}
        </Panel>
      </div>

      <Modal
        open={resolving}
        onClose={resolve.pending ? () => undefined : () => setResolving(false)}
        title={t("custom_apps:alerts.resolve_title")}
        className="max-w-md"
        help={help.form("alerts.resolve_form_help")}
      >
        <form onSubmit={submitResolve} className="flex flex-col gap-5" noValidate>
          <p className="text-sm leading-relaxed text-neutral-300">{t("custom_apps:alerts.resolve_body")}</p>
          <Field label={t("custom_apps:alerts.note")} htmlFor="alert-note" hint={t("custom_apps:alerts.note_hint")} help={help.field("alerts.help.note")}>
            <Textarea
              id="alert-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={NOTE_MAX}
              disabled={resolve.pending}
              className="resize-y"
            />
          </Field>
          {resolve.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${resolve.error}`, {defaultValue: resolve.error})}
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setResolving(false)} disabled={resolve.pending}>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={resolve.pending}>
              {resolve.pending ? <Spinner size={16} /> : <CheckCircle size={16} />}
              {t("custom_apps:alerts.resolve")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
