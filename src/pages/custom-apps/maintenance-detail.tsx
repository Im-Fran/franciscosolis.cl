import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {
  ArrowClockwise,
  CalendarCheck,
  CheckCircle,
  ClockCounterClockwise,
  Devices,
  PaperPlaneTilt,
  PencilSimple,
  Prohibit,
  ShieldCheck,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatLastSeen, formatMinutes} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {AuditEntry, Maintenance, MaintenanceInstallation, MaintenanceWindow} from "@/lib/custom-apps/types.ts";
import {formatZonedDateTime, formatZonedWindow} from "@/lib/custom-apps/zoned-time.ts";
import {AuditTrail} from "@/pages/custom-apps/components/audit-trail.tsx";
import {MaintenanceKindBadge, MaintenanceStatusBadge, Pill, StateBadge} from "@/pages/custom-apps/components/badges.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";
import {ConfirmActionDialog, NoteDialog} from "@/pages/custom-apps/components/maintenances/maintenance-actions.tsx";
import type {NoteMode} from "@/pages/custom-apps/components/maintenances/maintenance-actions.tsx";
import {MaintenanceDialog} from "@/pages/custom-apps/components/maintenances/maintenance-dialog.tsx";
import {isCancellable, isDeletable, isEditable} from "@/pages/custom-apps/components/maintenances/maintenance-format.ts";
import {useActionFailure} from "@/pages/custom-apps/components/maintenances/use-action-failure.ts";
import {SuggestionsPanel, WindowsPanel} from "@/pages/custom-apps/components/maintenances/windows-panel.tsx";
import {WorkLogPanel} from "@/pages/custom-apps/components/work-log/work-log-panel.tsx";
import type {WorkLogScope} from "@/pages/custom-apps/components/work-log/work-log-scope.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

/** Often enough to see the client's answer or the run's start land; not while a dialog is open. */
const REFRESH_MS = 30_000;

type Confirm = "send" | "resend" | "schedule" | "delete" | null;

const SubHeading = ({children}: {children: ReactNode}) => (
  <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{children}</p>
);

/** Ids listed by name where the included installations say what they are called, by short id otherwise. */
const InstallationList = ({ids, names, empty}: {ids: string[]; names: Map<string, string>; empty?: string}) => {
  if (ids.length === 0) return empty ? <p className="text-[13px] text-neutral-500">{empty}</p> : null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li key={id}>
          <Link
            to={customAppsRoute.installation(id)}
            className="inline-block rounded-[var(--radius-sm)] border border-neutral-800 px-2 py-0.5 text-[12px] text-neutral-300 hover:border-neutral-700 hover:text-text"
          >
            {names.get(id) ?? id.slice(0, 8)}
          </Link>
        </li>
      ))}
    </ul>
  );
};

/**
 * One scheduled maintenance — where the notification centre's links land, at
 * `/custom-apps/maintenances/:id`.
 *
 * It reads top to bottom as the maintenance's life: what it is and what can be done to it now (the
 * header's actions follow the status, as the service would refuse anything else with a 409); the
 * windows it is offered in, editable with suggestions over the usage heatmap while it is a draft or
 * nobody answered; the approval — who it went to, until when the links work, who answered and how,
 * a rejection's reason in full; the run — what it touched, what failed, the release it withdrew and
 * the mail that did not go out; the installations it includes now; the work it logged; and its
 * history from the audit log.
 *
 * Times are on the service's clock, Santiago, whatever zone the browser is in: the client reads the
 * same hours in the email.
 */
export const MaintenanceDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {maintenanceId = ""} = useParams<{maintenanceId: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const help = useHelp();
  const describeFailure = useActionFailure();
  const {timezone, maintenanceLimits} = useServiceVocabulary();
  const language = i18n.language;

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.maintenances.get(maintenanceId, signal), [maintenanceId]));
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  useEffect(() => {
    if (record.data) setMaintenance(record.data);
  }, [record.data]);

  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState<NoteMode | null>(null);
  useAutoRefresh(record.reload, REFRESH_MS, !editing && confirm === null && note === null);

  const current = maintenance && maintenance.id === maintenanceId ? maintenance : null;
  const appId = current?.app_id ?? "";
  const companyId = current?.company_id ?? "";

  const app = useResource(
    useCallback((signal: AbortSignal) => (appId ? customAppsApi.apps.get(appId, signal) : Promise.resolve(null)), [appId]),
  );
  const included = useResource(
    useCallback(
      (signal: AbortSignal) => (appId ? customAppsApi.maintenances.installations(maintenanceId, signal) : Promise.resolve([] as MaintenanceInstallation[])),
      /* Asked again when what it includes changes. */
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [maintenanceId, appId, current?.installation_ids.join(","), current?.release_id],
    ),
  );
  const names = useMemo(() => new Map((included.data ?? []).map((row) => [row.id, installationLabel(row)])), [included.data]);

  const action = useMutation(
    useCallback(
      (kind: Exclude<Confirm, null>) => {
        if (kind === "send") return customAppsApi.maintenances.send(maintenanceId);
        if (kind === "resend") return customAppsApi.maintenances.resend(maintenanceId);
        if (kind === "schedule") return customAppsApi.maintenances.schedule(maintenanceId);
        return customAppsApi.maintenances.remove(maintenanceId).then(() => null);
      },
      [maintenanceId],
    ),
  );

  const scope = useMemo<WorkLogScope | null>(() => (appId ? {kind: "app", appId, companyId} : null), [appId, companyId]);
  const back = {to: customAppsRoute.maintenances(), label: t("custom_apps:maintenances.back")};

  if (!current || !scope) {
    return (
      <>
        <PageHeader title={t("custom_apps:maintenances.loading_title")} back={back} />
        <Panel title={t("custom_apps:maintenances.summary")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const editable = isEditable(current);
  const security = current.kind === "security";
  const detail = current.result_detail ?? {};
  const windowsChanged = (windows: MaintenanceWindow[]) => setMaintenance({...current, windows});

  const openConfirm = (kind: Exclude<Confirm, null>) => {
    action.reset();
    setConfirm(kind);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const kind = confirm;
    const outcome = await action.run(kind);
    if (!outcome.ok) return;
    setConfirm(null);
    if (kind === "delete") {
      notify(t("admin:common.deleted"));
      navigate(customAppsRoute.appMaintenances(current.app_id));
      return;
    }
    if (outcome.data) setMaintenance(outcome.data);
    notify(t(`custom_apps:maintenance_actions.${kind}_done`));
  };

  const formatWindow = (window: MaintenanceWindow | null) => (window ? formatZonedWindow(window.starts_at, window.ends_at, language, timezone) : null);
  const when = (value: string | null) => (value ? formatZonedDateTime(value, language, timezone) : null);
  const firstWindowStarted = current.windows.some((window) => new Date(window.starts_at).getTime() <= Date.now());

  const actions = (
    <>
      {editable && (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <PencilSimple size={14} /> {t("custom_apps:maintenance_actions.edit")}
        </Button>
      )}
      {editable && !security && (
        <Button size="sm" onClick={() => openConfirm("send")} disabled={current.windows.length === 0}>
          <PaperPlaneTilt size={14} /> {t("custom_apps:maintenance_actions.send")}
        </Button>
      )}
      {editable && security && (
        <Button size="sm" onClick={() => openConfirm("schedule")}>
          <ShieldCheck size={14} /> {t("custom_apps:maintenance_actions.schedule")}
        </Button>
      )}
      {current.status === "pending_approval" && (
        <Button size="sm" variant="secondary" onClick={() => openConfirm("resend")}>
          <ArrowClockwise size={14} /> {t("custom_apps:maintenance_actions.resend")}
        </Button>
      )}
      {current.status === "in_progress" && (
        <>
          <Button size="sm" onClick={() => setNote("complete")}>
            <CheckCircle size={14} /> {t("custom_apps:maintenance_actions.complete")}
          </Button>
          <Button size="sm" variant="secondary" className="border-red-500/50 text-red-300 fs-ripple-danger" onClick={() => setNote("fail")}>
            <XCircle size={14} /> {t("custom_apps:maintenance_actions.fail")}
          </Button>
        </>
      )}
      {isCancellable(current) && (
        <Button size="sm" variant="ghost" className="text-red-300" onClick={() => setNote("cancel")}>
          <Prohibit size={14} /> {t("custom_apps:maintenance_actions.cancel")}
        </Button>
      )}
      {isDeletable(current) && (
        <Button size="sm" variant="ghost" className="text-red-300" onClick={() => openConfirm("delete")}>
          <Trash size={14} /> {t("admin:common.delete")}
        </Button>
      )}
    </>
  );

  const cancelReason = current.cancel_reason
    ? current.cancelled_by
      ? current.cancel_reason
      : t(`custom_apps:maintenances.cancel_reasons.${current.cancel_reason}`, {defaultValue: current.cancel_reason})
    : null;
  const failureReason = detail.failure?.reason
    ? t(`custom_apps:maintenances.failure_reasons.${detail.failure.reason}`, {defaultValue: detail.failure.reason})
    : null;

  return (
    <>
      <PageHeader
        title={current.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <MaintenanceStatusBadge value={current.status} rejected={current.rejected} />
            <MaintenanceKindBadge value={current.kind} />
            <Link to={customAppsRoute.appMaintenances(current.app_id)} className="hover:text-text hover:underline">
              {current.app_name ?? current.app_id}
            </Link>
            <span aria-hidden="true">·</span>
            <Link to={customAppsRoute.company(current.company_id)} className="hover:text-text hover:underline">
              {current.company_name ?? current.company_id}
            </Link>
          </span>
        }
        back={back}
        actions={actions}
      />

      <div className="flex flex-col gap-6">
        {current.rejected && (
          <Alert tone="error" title={t("custom_apps:maintenances.rejected_title", {name: current.responded_by_name || current.responded_by || t("custom_apps:maintenances.the_client")})}>
            <blockquote className="my-1 border-l-2 border-red-400/60 pl-3 whitespace-pre-line text-text">{current.rejection_reason}</blockquote>
            <p className="mt-2">{t("custom_apps:maintenances.reschedule_hint")}</p>
          </Alert>
        )}
        {current.status === "no_response" && (
          <Alert tone="error" title={t("custom_apps:maintenances.no_response_title")}>
            {t("custom_apps:maintenances.no_response_body", {sends: current.sends, lead: maintenanceLimits.min_lead_hours})}
          </Alert>
        )}
        {current.status === "failed" && (
          <Alert tone="error" title={t("custom_apps:maintenances.failed_title")}>
            {[failureReason, detail.note].filter(Boolean).join(" · ")}
          </Alert>
        )}
        {current.status === "cancelled" && (
          <Alert tone="info" title={t("custom_apps:maintenances.cancelled_title")}>
            {t("custom_apps:maintenances.cancelled_body", {
              date: when(current.cancelled_at),
              by: current.cancelled_by ?? t("custom_apps:audit.automatic"),
            })}
            {cancelReason && <span className="mt-1 block text-text">{cancelReason}</span>}
          </Alert>
        )}
        {current.status === "pending_approval" && (
          <Alert tone="info" title={t("custom_apps:maintenances.pending_title")}>
            {t("custom_apps:maintenances.pending_body", {
              expires: when(current.link_expires_at),
              resend: maintenanceLimits.resend_after_hours,
              lead: maintenanceLimits.min_lead_hours,
            })}
          </Alert>
        )}
        {editable && security && (
          <Alert tone="info" title={t("custom_apps:maintenances.security_title")}>
            {t("custom_apps:maintenances.security_body", {lead: Math.round(maintenanceLimits.security_min_lead_minutes / 60)})}
          </Alert>
        )}
        {editable && !security && firstWindowStarted && (
          <Alert tone="error" title={t("custom_apps:maintenances.window_started_title")}>
            {t("custom_apps:maintenances.errors.window_started")}
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            <Panel title={t("custom_apps:maintenances.summary")}>
              <p className="mb-5 text-[14px] leading-relaxed whitespace-pre-line text-neutral-200">{current.description}</p>
              <DetailList>
                <Detail label={t("custom_apps:maintenances.fields.duration")}>{formatMinutes(current.estimated_minutes)}</Detail>
                <Detail label={t("custom_apps:maintenances.fields.release")}>
                  {current.release ? (
                    <Link to={customAppsRoute.release(current.release.id)} className="hover:underline">
                      v{current.release.version}
                      <span className="text-neutral-500">
                        {" "}
                        · {t(`custom_apps:channels.${current.release.channel}`, {defaultValue: current.release.channel})} ·{" "}
                        {t(`custom_apps:release_statuses.${current.release.status}`, {defaultValue: current.release.status})}
                      </span>
                    </Link>
                  ) : (
                    t("custom_apps:maintenances.no_release")
                  )}
                </Detail>
                <Detail label={t("custom_apps:maintenances.fields.installations")}>
                  {current.all_installations
                    ? t("custom_apps:maintenances.installations_all")
                    : t("custom_apps:maintenances.installations_count", {count: current.installation_ids.length})}
                </Detail>
                <Detail label={t("custom_apps:maintenances.created")}>
                  {formatDateTime(current.created_at, language)}
                  {current.created_by && <span className="block text-[12px] text-neutral-500">{current.created_by}</span>}
                </Detail>
                <Detail label={t("custom_apps:maintenances.updated")}>
                  {formatLastSeen(current.updated_at, language)}
                  {current.updated_by && <span className="block text-[12px] text-neutral-500">{current.updated_by}</span>}
                </Detail>
              </DetailList>
            </Panel>

            <WindowsPanel maintenance={current} editable={editable} onChanged={windowsChanged} />
            {editable && <SuggestionsPanel maintenance={current} app={app.data} onChanged={windowsChanged} />}
          </div>

          <div className="flex flex-col gap-6">
            <Panel title={security ? t("custom_apps:maintenances.notice_title") : t("custom_apps:maintenances.approval_title")}>
              <DetailList className="sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-1">
                <Detail label={t("custom_apps:maintenances.chosen_window")}>
                  {current.chosen_window ? (
                    <>
                      {formatWindow(current.chosen_window)}
                      <span className="block text-[12px] text-neutral-500">
                        {security
                          ? t("custom_apps:maintenances.how.security")
                          : current.auto_applied
                            ? t("custom_apps:maintenances.how.auto_applied")
                            : t("custom_apps:maintenances.how.approved")}
                      </span>
                    </>
                  ) : null}
                </Detail>
                {!security && (
                  <>
                    <Detail label={t("custom_apps:maintenances.sends")}>
                      {current.sends > 0 ? t("custom_apps:maintenances.sends_value", {count: current.sends, date: when(current.last_sent_at)}) : null}
                    </Detail>
                    <Detail label={t("custom_apps:maintenances.recipients")}>
                      {current.recipients.length > 0 ? (
                        <ul className="flex flex-col gap-0.5">
                          {current.recipients.map((recipient) => (
                            <li key={recipient} className="break-all">
                              {recipient}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Detail>
                    <Detail label={t("custom_apps:maintenances.link_expires")}>{when(current.link_expires_at)}</Detail>
                  </>
                )}
                <Detail label={t("custom_apps:maintenances.responded")}>
                  {current.responded_at ? (
                    <>
                      {[current.responded_by_name, current.responded_by].filter(Boolean).join(" · ")}
                      <span className="block text-[12px] text-neutral-500">{when(current.responded_at)}</span>
                    </>
                  ) : null}
                </Detail>
                {current.rejected_at && (
                  <Detail label={t("custom_apps:maintenances.rejected_at")}>
                    {when(current.rejected_at)}
                    {current.rejection_reason && <span className="mt-1 block text-[13px] whitespace-pre-line text-red-200">{current.rejection_reason}</span>}
                  </Detail>
                )}
                <Detail label={t("custom_apps:maintenances.scheduled_at")}>{when(current.scheduled_at)}</Detail>
                <Detail label={t("custom_apps:maintenances.reminder_sent_at")}>{when(current.reminder_sent_at)}</Detail>
              </DetailList>
            </Panel>

            <Panel title={t("custom_apps:maintenances.run_title")}>
              {!current.started_at && !current.finished_at ? (
                <p className="text-[13px] text-neutral-500">{t("custom_apps:maintenances.run_empty")}</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <DetailList className="sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-1">
                    <Detail label={t("custom_apps:maintenances.started_at")}>{when(current.started_at)}</Detail>
                    <Detail label={t("custom_apps:maintenances.finished_at")}>
                      {when(current.finished_at)}
                      {current.finished_at && (
                        <span className="block text-[12px] text-neutral-500">{current.closed_by ?? t("custom_apps:audit.automatic")}</span>
                      )}
                    </Detail>
                    <Detail label={t("custom_apps:maintenances.columns.result")}>
                      {current.result === "succeeded" ? (
                        <Pill tone="good">{t("custom_apps:maintenances.results.succeeded")}</Pill>
                      ) : current.result === "failed" ? (
                        <Pill tone="bad">{t("custom_apps:maintenances.results.failed")}</Pill>
                      ) : null}
                    </Detail>
                    {detail.note && <Detail label={t("custom_apps:maintenances.note")}>{detail.note}</Detail>}
                  </DetailList>

                  {detail.installations && (
                    <div>
                      <SubHeading>{t("custom_apps:maintenances.result.installations", {count: detail.installations.length})}</SubHeading>
                      <InstallationList ids={detail.installations} names={names} empty={t("custom_apps:maintenances.result.none")} />
                    </div>
                  )}
                  {detail.targets && (
                    <div>
                      <SubHeading>{t("custom_apps:maintenances.result.targets", {count: detail.targets.length})}</SubHeading>
                      <InstallationList ids={detail.targets} names={names} empty={t("custom_apps:maintenances.result.none")} />
                    </div>
                  )}
                  {(detail.already_on_version?.length ?? 0) > 0 && (
                    <div>
                      <SubHeading>{t("custom_apps:maintenances.result.already_on_version", {count: detail.already_on_version!.length})}</SubHeading>
                      <InstallationList ids={detail.already_on_version!} names={names} />
                    </div>
                  )}
                  {(detail.off_line?.length ?? 0) > 0 && (
                    <div>
                      <SubHeading>{t("custom_apps:maintenances.result.off_line", {count: detail.off_line!.length})}</SubHeading>
                      <InstallationList ids={detail.off_line!} names={names} />
                    </div>
                  )}
                  {(detail.skipped?.length ?? 0) > 0 && (
                    <div>
                      <SubHeading>{t("custom_apps:maintenances.result.skipped", {count: detail.skipped!.length})}</SubHeading>
                      <ul className="flex flex-col gap-1 text-[13px]">
                        {detail.skipped!.map((entry) => (
                          <li key={entry.id} className="flex flex-wrap items-center gap-2">
                            <Link to={customAppsRoute.installation(entry.id)} className="text-neutral-300 hover:underline">
                              {names.get(entry.id) ?? entry.id.slice(0, 8)}
                            </Link>
                            <StateBadge state={entry.reason} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(detail.failure?.installations?.length ?? 0) > 0 && (
                    <div>
                      <SubHeading>{t("custom_apps:maintenances.result.failing", {count: detail.failure!.installations!.length})}</SubHeading>
                      <ul className="flex flex-col gap-1 text-[13px]">
                        {detail.failure!.installations!.map((entry) => (
                          <li key={entry.id} className="flex flex-wrap items-center gap-2">
                            <Link to={customAppsRoute.installation(entry.id)} className="text-neutral-300 hover:underline">
                              {names.get(entry.id) ?? entry.id.slice(0, 8)}
                            </Link>
                            <Pill tone="bad">
                              {t(`custom_apps:update_report_statuses.${entry.status}`, {
                                defaultValue: t(`custom_apps:maintenances.result.statuses.${entry.status}`, {defaultValue: entry.status}),
                              })}
                            </Pill>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detail.release && (
                    <p className="text-[13px] text-neutral-400">
                      {detail.release.published_by_maintenance
                        ? t("custom_apps:maintenances.result.release_published", {version: detail.release.version})
                        : t("custom_apps:maintenances.result.release_extended", {version: detail.release.version, count: detail.release.added_installations.length})}{" "}
                      <Link to={customAppsRoute.release(detail.release.id)} className="hover:text-text hover:underline">
                        {t("custom_apps:maintenances.result.open_release")}
                      </Link>
                    </p>
                  )}
                  {detail.withdrawn && current.release_id && (
                    <Alert tone="error" title={t("custom_apps:maintenances.result.withdrawn_title")}>
                      {t("custom_apps:maintenances.result.withdrawn_body", {version: current.release?.version ?? ""})}{" "}
                      <Link to={customAppsRoute.release(current.release_id)} className="underline">
                        {t("custom_apps:maintenances.result.open_release")}
                      </Link>
                    </Alert>
                  )}
                </div>
              )}
              {(detail.mail_failures?.length ?? 0) > 0 && (
                <Alert tone="error" title={t("custom_apps:maintenances.result.mail_failures_title")} className="mt-5">
                  <ul className="flex flex-col gap-1">
                    {detail.mail_failures!.map((failure, index) => (
                      <li key={`${failure.stage}-${index}`}>
                        {t(`custom_apps:maintenances.mail_stages.${failure.stage}`, {defaultValue: failure.stage})}: {failure.recipients.join(", ")}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </Panel>
          </div>
        </div>

        <Panel
          title={t("custom_apps:maintenances.included_title")}
          description={
            current.all_installations ? t("custom_apps:maintenances.included_all") : t("custom_apps:maintenances.included_named", {count: current.installation_ids.length})
          }
        >
          <PanelState loading={included.loading && !included.data} error={included.data ? null : included.error} onRetry={included.reload} ns="admin">
            {(included.data ?? []).length === 0 ? (
              <EmptyState icon={<Devices size={28} />} title={t("custom_apps:maintenances.included_empty")} />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {(included.data ?? []).map((row) => (
                  <li key={row.id}>
                    <Link
                      to={customAppsRoute.installation(row.id)}
                      className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-neutral-800 px-3 py-2.5 transition-colors hover:border-neutral-700"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-text">{installationLabel(row)}</span>
                        {row.state_override && <StateBadge state={row.state_override} />}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-neutral-500">
                        {[t(`custom_apps:channels.${row.channel}`, {defaultValue: row.channel}), row.platform, row.arch, row.app_version && `v${row.app_version}`]
                          .filter(Boolean)
                          .join(" · ")}
                        {row.on_release_line === false && <span className="font-sans text-amber-300">{t("custom_apps:maintenances.off_line")}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelState>
        </Panel>

        <WorkLogPanel
          scope={scope}
          maintenance={{id: current.id, title: current.title}}
          title={t("custom_apps:maintenances.work_log_title")}
          description={t("custom_apps:maintenances.work_log_description")}
        />

        <AuditTrail
          title={t("custom_apps:maintenances.history_title")}
          query={{resource_type: "maintenance", resource_id: current.id}}
          emptyTitle={t("custom_apps:maintenances.history_empty")}
          icon={<ClockCounterClockwise size={28} />}
          describe={(entry: AuditEntry) => describeAudit(entry, t, language, timezone)}
        />
      </div>

      {editing && (
        <MaintenanceDialog
          open
          appId={current.app_id}
          maintenance={current}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setMaintenance(saved);
            notify(t("admin:common.saved"));
          }}
        />
      )}

      <ConfirmActionDialog
        open={confirm === "send" || confirm === "resend"}
        title={confirm === "resend" ? t("custom_apps:maintenance_actions.resend_title") : t("custom_apps:maintenance_actions.send_title")}
        body={
          confirm === "resend"
            ? t("custom_apps:maintenance_actions.resend_body")
            : t("custom_apps:maintenance_actions.send_body", {count: current.windows.length, resend: maintenanceLimits.resend_after_hours})
        }
        confirmLabel={confirm === "resend" ? t("custom_apps:maintenance_actions.resend") : t("custom_apps:maintenance_actions.send")}
        icon={<PaperPlaneTilt size={16} />}
        help={help.form(confirm === "resend" ? "maintenance_actions.form_help_resend" : "maintenance_actions.form_help_send", {
          resend: maintenanceLimits.resend_after_hours,
          lead: maintenanceLimits.min_lead_hours,
        })}
        pending={action.pending}
        error={action.error ? describeFailure(action.status, action.error) : null}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />

      <ConfirmActionDialog
        open={confirm === "schedule"}
        title={t("custom_apps:maintenance_actions.schedule_title")}
        body={t("custom_apps:maintenance_actions.schedule_body", {lead: Math.round(maintenanceLimits.security_min_lead_minutes / 60)})}
        confirmLabel={t("custom_apps:maintenance_actions.schedule")}
        icon={<CalendarCheck size={16} />}
        help={help.form("maintenance_actions.form_help_schedule", {lead: Math.round(maintenanceLimits.security_min_lead_minutes / 60)})}
        pending={action.pending}
        error={action.error ? describeFailure(action.status, action.error) : null}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        title={t("custom_apps:maintenance_actions.delete_title")}
        body={t("custom_apps:maintenance_actions.delete_body", {title: current.title})}
        confirmLabel={action.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void runConfirm()}
        onClose={() => setConfirm(null)}
        pending={action.pending}
        error={action.error}
      />

      <NoteDialog
        mode={note}
        maintenance={current}
        onClose={() => setNote(null)}
        onDone={(updated) => {
          const mode = note;
          setNote(null);
          setMaintenance(updated);
          notify(t(`custom_apps:maintenance_actions.${mode}_done`));
        }}
      />
    </>
  );
};

/** The line under an audit event: the reason, the note, the window, who answered through the link. */
const describeAudit = (entry: AuditEntry, t: (key: string, options?: Record<string, unknown>) => string, language: string, timezone: string) => {
  const metadata = entry.metadata ?? {};
  const parts: string[] = [];
  const window = metadata.window as {starts_at?: string; ends_at?: string} | undefined;
  if (window?.starts_at && window.ends_at) parts.push(formatZonedWindow(window.starts_at, window.ends_at, language, timezone));
  if (typeof metadata.starts_at === "string" && typeof metadata.ends_at === "string") {
    parts.push(formatZonedWindow(metadata.starts_at, metadata.ends_at, language, timezone));
  }
  if (metadata.via === "approval_link") {
    parts.push(t("custom_apps:maintenances.via_link", {name: typeof metadata.name === "string" && metadata.name ? metadata.name : entry.actor_email ?? ""}));
  }
  if (Array.isArray(metadata.recipients) && metadata.recipients.length > 0) {
    parts.push(t("custom_apps:maintenances.sent_to", {list: (metadata.recipients as string[]).join(", ")}));
  }
  if (Array.isArray(metadata.failed) && metadata.failed.length > 0) {
    parts.push(t("custom_apps:maintenances.not_sent_to", {list: (metadata.failed as string[]).join(", ")}));
  }
  if (typeof metadata.reason === "string" && metadata.reason) {
    parts.push(
      metadata.automatic === true
        ? t(`custom_apps:maintenances.cancel_reasons.${metadata.reason}`, {
            defaultValue: t(`custom_apps:maintenances.failure_reasons.${metadata.reason}`, {defaultValue: metadata.reason}),
          })
        : metadata.reason,
    );
  }
  if (typeof metadata.cause === "string") parts.push(t(`custom_apps:maintenances.causes.${metadata.cause}`, {defaultValue: metadata.cause}));
  if (typeof metadata.note === "string" && metadata.note) parts.push(metadata.note);
  return parts.length > 0 ? parts.join(" · ") : null;
};
