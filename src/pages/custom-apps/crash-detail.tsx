import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {useParams} from "react-router-dom";
import {ArrowCounterClockwise, CheckCircle, EyeSlash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatNumber} from "@/lib/custom-apps/format.ts";
import type {CrashGroup, CrashStatus} from "@/lib/custom-apps/types.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {CrashStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {CrashReports} from "@/pages/custom-apps/components/crashes/crash-reports.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";

/**
 * One crash group: what it is, how widespread, and every report behind it with its stack.
 *
 * Resolving says "fixed in a later build"; a resolved crash that happens again is opened again by
 * the service. Ignoring says "known, and not worth fixing" — it stays ignored.
 */
export const CrashDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {crashId = ""} = useParams<{crashId: string}>();
  const {notify} = useToast();
  const language = i18n.language;

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.crashes.get(crashId, signal), [crashId]));
  const [crash, setCrash] = useState<CrashGroup | null>(null);
  useEffect(() => {
    if (record.data) setCrash(record.data);
  }, [record.data]);

  const change = useMutation(useCallback((status: CrashStatus) => customAppsApi.crashes.setStatus(crashId, status), [crashId]));
  const [target, setTarget] = useState<CrashStatus | null>(null);

  const current = crash && crash.id === crashId ? crash : null;
  const back = current?.app_id
    ? {to: customAppsRoute.appDiagnostics(current.app_id), label: t("custom_apps:crashes.back")}
    : {to: customAppsRoute.apps, label: t("custom_apps:apps.back")};

  if (!current) {
    return (
      <>
        <PageHeader title={t("custom_apps:crashes.loading_title")} back={back} />
        <Panel title={t("custom_apps:crashes.details")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const setStatus = async (status: CrashStatus) => {
    setTarget(status);
    const outcome = await change.run(status);
    setTarget(null);
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    setCrash(outcome.data);
    notify(t(`custom_apps:crashes.status_changed.${status}`, {defaultValue: t("admin:common.saved")}));
  };

  const action = (status: CrashStatus, label: string, Icon: typeof CheckCircle) => (
    <Button variant={status === "resolved" ? "primary" : "secondary"} onClick={() => void setStatus(status)} disabled={change.pending}>
      {target === status ? <Spinner size={16} /> : <Icon size={16} />}
      {label}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={current.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CrashStatusBadge value={current.status} />
            {current.app_version && <span className="font-mono text-[13px]">v{current.app_version}</span>}
          </span>
        }
        back={back}
        actions={
          <>
            {current.status !== "resolved" && action("resolved", t("custom_apps:crashes.resolve"), CheckCircle)}
            {current.status !== "ignored" && action("ignored", t("custom_apps:crashes.ignore"), EyeSlash)}
            {current.status !== "open" && action("open", t("custom_apps:crashes.reopen"), ArrowCounterClockwise)}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <Panel title={t("custom_apps:crashes.details")}>
          <DetailList>
            <Detail label={t("custom_apps:crashes.signature")} mono>
              {current.signature}
            </Detail>
            <Detail label={t("custom_apps:crashes.columns.occurrences")}>{formatNumber(current.occurrences, language)}</Detail>
            <Detail label={t("custom_apps:crashes.affected_label")}>{formatNumber(current.affected_installations, language)}</Detail>
            <Detail label={t("custom_apps:crashes.first_seen")}>{formatDateTime(current.first_seen_at, language)}</Detail>
            <Detail label={t("custom_apps:crashes.columns.last_seen")}>{formatDateTime(current.last_seen_at, language)}</Detail>
            <Detail label={t("custom_apps:crashes.resolved_at")}>
              {current.resolved_at &&
                `${formatDateTime(current.resolved_at, language)}${current.resolved_by ? ` · ${current.resolved_by}` : ""}`}
            </Detail>
          </DetailList>
          <p className="mt-6 border-t border-neutral-800 pt-5 text-[13px] leading-relaxed text-neutral-500">
            {t("custom_apps:crashes.status_help")}
          </p>
        </Panel>

        <CrashReports crashId={current.id} />
      </div>
    </>
  );
};
