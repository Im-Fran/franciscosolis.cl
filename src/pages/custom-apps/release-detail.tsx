import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {
  ArrowUUpLeft,
  DownloadSimple,
  FloppyDisk,
  Pause,
  PencilSimple,
  Play,
  Prohibit,
  RocketLaunch,
  Sliders,
  Trash,
} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatBytes, formatNumber, formatPercent} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import {UPDATE_SETTINGS} from "@/lib/custom-apps/types.ts";
import type {ReleaseDetail as Release, ReleasePayload} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {ReleaseStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {CopyField} from "@/pages/custom-apps/components/copy-button.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {installationNames, useAppInstallations} from "@/pages/custom-apps/components/use-app-installations.ts";
import {ReasonDialog, RolloutDialog} from "@/pages/custom-apps/components/releases/release-dialogs.tsx";
import {describeUploader, isSemver, releaseLine, saveBlob} from "@/pages/custom-apps/components/releases/release-format.ts";
import {ReleaseReports} from "@/pages/custom-apps/components/releases/release-reports.tsx";
import {ReleaseStatusReason} from "@/pages/custom-apps/components/releases/release-status-reason.tsx";
import {StatCard} from "@/pages/custom-apps/components/stat-card.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

/** A published rollout is moving; its figures are worth asking for again while somebody watches. */
const REFRESH_MS = 30_000;
const NOTES_MAX = 10_000;

type ReasonAction = "pause" | "withdraw" | "rollback";

/**
 * One release: what it is, how far it reaches, how the devices that took it are doing, and every
 * decision that can still be made about it.
 *
 * What can be done follows the status, as the service enforces it: a draft is published or deleted;
 * a published release has its rollout widened or narrowed, is paused or withdrawn; a paused one is
 * resumed; and any release that was ever out can become the target of a rollback of its whole line.
 * The service refuses the rest with a 409, so the page does not offer it.
 *
 * The app is loaded beside the release for its name and its pause thresholds, so each rate reads
 * against the number that would pause it.
 */
export const ReleaseDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {releaseId = ""} = useParams<{releaseId: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const language = i18n.language;

  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.releases.get(releaseId, signal), [releaseId]));
  const [release, setRelease] = useState<Release | null>(null);
  const [reportsVersion, setReportsVersion] = useState(0);
  useEffect(() => {
    if (!record.data) return;
    setRelease(record.data);
    setReportsVersion((value) => value + 1);
  }, [record.data]);

  const current = release && release.id === releaseId ? release : null;
  const appId = current?.app_id ?? "";
  const appRecord = useResource(
    useCallback((signal: AbortSignal) => (appId ? customAppsApi.apps.get(appId, signal) : Promise.resolve(null)), [appId]),
  );
  const app = appRecord.data && appRecord.data.id === appId ? appRecord.data : null;
  const installations = useAppInstallations(appId);
  const names = useMemo(() => installationNames(installations.data?.data), [installations.data]);

  const [rollout, setRollout] = useState<"publish" | "rollout" | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  /* Not while a dialog is open: a refresh would hand it a new release and reset what was chosen. */
  const dialogOpen = rollout !== null || reasonAction !== null || askDelete || editing;
  useAutoRefresh(record.reload, REFRESH_MS, current?.status === "published" && !dialogOpen);
  const [notes, setNotes] = useState("");
  const [minVersion, setMinVersion] = useState("");
  const [minVersionError, setMinVersionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const act = useMutation(
    useCallback(
      (action: ReasonAction, reason: string | null) => {
        switch (action) {
          case "pause":
            return customAppsApi.releases.pause(releaseId, reason);
          case "withdraw":
            return customAppsApi.releases.withdraw(releaseId, reason);
          default:
            return customAppsApi.releases.rollback(releaseId, reason);
        }
      },
      [releaseId],
    ),
  );
  const resume = useMutation(useCallback(() => customAppsApi.releases.resume(releaseId), [releaseId]));
  const remove = useMutation(useCallback(() => customAppsApi.releases.remove(releaseId), [releaseId]));
  const update = useMutation(useCallback((body: ReleasePayload) => customAppsApi.releases.update(releaseId, body), [releaseId]));

  const back = current
    ? {to: customAppsRoute.appReleases(current.app_id), label: t("custom_apps:release.back")}
    : {to: customAppsRoute.apps, label: t("custom_apps:apps.back")};

  if (!current) {
    return (
      <>
        <PageHeader title={t("custom_apps:release.loading_title")} back={back} />
        <Panel title={t("custom_apps:release.details")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  /** A write answered with the release as it now stands: show it, and the reports beside it. */
  const take = (next: Release) => {
    setRelease(next);
    setReportsVersion((value) => value + 1);
  };

  const confirmReason = async (reason: string | null) => {
    if (!reasonAction) return;
    const outcome = await act.run(reasonAction, reason);
    if (!outcome.ok) return;
    take(outcome.data);
    notify(t(`custom_apps:release.done.${reasonAction}`));
    setReasonAction(null);
  };

  const doResume = async () => {
    const outcome = await resume.run();
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    take(outcome.data);
    notify(t("custom_apps:release.done.resume"));
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(customAppsRoute.appReleases(current.app_id), {replace: true});
  };

  const download = async () => {
    setDownloading(true);
    try {
      saveBlob(await customAppsApi.releases.artifact(current.id), current.filename);
    } catch {
      notify(t("custom_apps:release.download_failed"), "error");
    } finally {
      setDownloading(false);
    }
  };

  const openEdit = () => {
    update.reset();
    setNotes(current.notes ?? "");
    setMinVersion(current.min_version ?? "");
    setMinVersionError(null);
    setEditing(true);
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    const min = minVersion.trim();
    if (min && !isSemver(min)) {
      setMinVersionError(t("custom_apps:release.min_version_invalid"));
      return;
    }
    const body: ReleasePayload = {};
    if (notes.trim() !== (current.notes ?? "")) body.notes = notes.trim() || null;
    if (min !== (current.min_version ?? "")) body.min_version = min || null;
    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }
    const outcome = await update.run(body);
    if (!outcome.ok) return;
    take(outcome.data);
    setEditing(false);
    notify(t("admin:common.saved"));
  };

  const {status, stats} = current;
  const live = status === "published" || status === "paused";
  const rollbackThreshold = app?.rollout_pause_rollback_percent ?? UPDATE_SETTINGS.pauseRollbackPercent.default;
  const crashThreshold = app?.rollout_pause_crash_percent ?? UPDATE_SETTINGS.pauseCrashPercent.default;
  const named = current.rollout_installations;

  const reasonCopy: Record<ReasonAction, {title: string; body: string; confirm: string; danger: boolean}> = {
    pause: {
      title: t("custom_apps:release.pause_title"),
      body: t("custom_apps:release.pause_body"),
      confirm: t("custom_apps:release.pause"),
      danger: false,
    },
    withdraw: {
      title: t("custom_apps:release.withdraw_title", {version: current.version}),
      body: t("custom_apps:release.withdraw_body"),
      confirm: t("custom_apps:release.withdraw"),
      danger: true,
    },
    rollback: {
      title: t("custom_apps:release.rollback_title", {version: current.version}),
      body: t("custom_apps:release.rollback_body", {version: current.version, line: releaseLine(current, t)}),
      confirm: t("custom_apps:release.rollback"),
      danger: true,
    },
  };

  const ask = (action: ReasonAction) => {
    act.reset();
    setReasonAction(action);
  };

  return (
    <>
      <PageHeader
        title={t("custom_apps:release.title", {version: current.version})}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ReleaseStatusBadge value={status} />
            <span>{releaseLine(current, t)}</span>
            {app && (
              <>
                <span className="text-neutral-700" aria-hidden="true">·</span>
                <Link to={customAppsRoute.app(app.id)} className="hover:text-text hover:underline">
                  {app.name}
                </Link>
              </>
            )}
          </span>
        }
        back={back}
        actions={
          <>
            <Button variant="ghost" onClick={() => void download()} disabled={downloading}>
              {downloading ? <Spinner size={16} /> : <DownloadSimple size={16} />}
              {t("custom_apps:release.download")}
            </Button>
            {status === "draft" && (
              <>
                <Button onClick={() => setRollout("publish")}>
                  <RocketLaunch size={16} /> {t("custom_apps:release.publish")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    remove.reset();
                    setAskDelete(true);
                  }}
                  className="border-red-500/50 text-red-300 fs-ripple-danger"
                >
                  <Trash size={16} /> {t("custom_apps:release.delete")}
                </Button>
              </>
            )}
            {status === "paused" && (
              <Button onClick={() => void doResume()} disabled={resume.pending}>
                {resume.pending ? <Spinner size={16} /> : <Play size={16} />}
                {t("custom_apps:release.resume")}
              </Button>
            )}
            {live && (
              <Button variant="secondary" onClick={() => setRollout("rollout")}>
                <Sliders size={16} /> {t("custom_apps:release.rollout_change")}
              </Button>
            )}
            {status === "published" && (
              <Button variant="secondary" onClick={() => ask("pause")}>
                <Pause size={16} /> {t("custom_apps:release.pause")}
              </Button>
            )}
            {live && (
              <Button
                variant="secondary"
                onClick={() => ask("withdraw")}
                className="border-red-500/50 text-red-300 fs-ripple-danger"
              >
                <Prohibit size={16} /> {t("custom_apps:release.withdraw")}
              </Button>
            )}
            {status !== "draft" && (
              <Button variant="secondary" onClick={() => ask("rollback")}>
                <ArrowUUpLeft size={16} /> {t("custom_apps:release.rollback")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <ReleaseStatusReason release={current} />

        {status === "paused" && current.status_reason?.automatic && (
          <p className="-mt-3 text-[12px] leading-relaxed text-neutral-500">{t("custom_apps:release.resume_warning")}</p>
        )}

        {status === "draft" && (
          <Alert tone="info" title={t("custom_apps:release.draft_title")}>
            {t("custom_apps:release.draft_body")}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("custom_apps:release.stats.downloaded")}
            value={formatNumber(stats.downloaded, language)}
            detail={t("custom_apps:release.stats.downloaded_detail")}
          />
          <StatCard
            label={t("custom_apps:release.stats.installed")}
            value={formatNumber(stats.installed, language)}
            detail={t("custom_apps:release.stats.installed_detail")}
          />
          <StatCard
            label={t("custom_apps:release.stats.health_ok")}
            value={formatNumber(stats.health_ok, language)}
            detail={t("custom_apps:release.stats.health_ok_detail")}
          />
          <StatCard
            label={t("custom_apps:release.stats.rolled_back")}
            value={formatNumber(stats.rolled_back, language)}
            attention={stats.rolled_back > 0}
            detail={t("custom_apps:release.stats.rolled_back_detail")}
          />
          <StatCard
            label={t("custom_apps:release.stats.failed")}
            value={formatNumber(stats.failed, language)}
            attention={stats.failed > 0}
            detail={t("custom_apps:release.stats.failed_detail")}
          />
          <StatCard
            label={t("custom_apps:release.stats.crashed")}
            value={formatNumber(stats.crashed, language)}
            attention={stats.crashed > 0}
            detail={t("custom_apps:release.stats.crashed_detail")}
          />
          <StatCard
            label={t("custom_apps:release.stats.rollback_rate")}
            value={formatPercent(stats.rollback_rate, language, 1) ?? "—"}
            attention={stats.rollback_rate !== null && stats.rollback_rate >= rollbackThreshold}
            detail={t("custom_apps:release.stats.rollback_rate_detail", {threshold: formatPercent(rollbackThreshold, language)})}
          />
          <StatCard
            label={t("custom_apps:release.stats.crash_rate")}
            value={formatPercent(stats.crash_rate, language, 1) ?? "—"}
            attention={stats.crash_rate !== null && stats.crash_rate >= crashThreshold}
            detail={t("custom_apps:release.stats.crash_rate_detail", {threshold: formatPercent(crashThreshold, language)})}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Panel title={t("custom_apps:release.reach_title")} description={t("custom_apps:release.reach_description")}>
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[28px] leading-none text-text tabular-nums">
                    {status === "draft" ? "—" : `${current.rollout_percent} %`}
                  </span>
                  <span className="text-[13px] text-neutral-500">
                    {status === "draft"
                      ? t("custom_apps:release.reach_draft")
                      : status === "published"
                        ? t("custom_apps:release.reach_published")
                        : t("custom_apps:release.reach_stopped")}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800" aria-hidden="true">
                  <div
                    className={cn("h-full rounded-full", status === "published" ? "bg-emerald-400/80" : "bg-neutral-600")}
                    style={{width: `${status === "draft" ? 0 : current.rollout_percent}%`}}
                  />
                </div>
              </div>
              <DetailList className="lg:grid-cols-2">
                <Detail label={t("custom_apps:release.on_line")}>{formatNumber(current.installations_on_line, language)}</Detail>
                <Detail label={t("custom_apps:release.on_version")}>
                  {t("custom_apps:release.on_version_value", {
                    count: current.installations_on_version,
                    value: formatNumber(current.installations_on_version, language),
                    total: formatNumber(current.installations_on_line, language),
                  })}
                </Detail>
              </DetailList>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:release.named")}</span>
                {named.length === 0 ? (
                  <p className="text-[13px] text-neutral-500">{t("custom_apps:release.named_none")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {named.map((id) => (
                      <li key={id}>
                        <Link
                          to={customAppsRoute.installation(id)}
                          className="inline-block rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 px-2 py-0.5 text-[12px] text-neutral-300 hover:text-text"
                        >
                          {names.get(id) ?? id.slice(0, 8)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title={t("custom_apps:release.notes_title")}
            action={
              <Button variant="ghost" size="sm" onClick={openEdit}>
                <PencilSimple size={14} /> {t("custom_apps:release.edit")}
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              {current.notes ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-neutral-300">{current.notes}</p>
              ) : (
                <p className="text-[13px] text-neutral-500">{t("custom_apps:release.no_notes")}</p>
              )}
              <p className="border-t border-neutral-800 pt-4 text-[13px] leading-relaxed text-neutral-400">
                {current.min_version
                  ? t("custom_apps:release.min_version_value", {min: current.min_version})
                  : t("custom_apps:release.min_version_none")}
              </p>
            </div>
          </Panel>
        </div>

        <Panel title={t("custom_apps:release.details")}>
          <DetailList>
            <Detail label={t("custom_apps:release.filename")} mono>
              {current.filename}
            </Detail>
            <Detail label={t("custom_apps:release.size")}>{formatBytes(current.size_bytes, language)}</Detail>
            <Detail label={t("custom_apps:release.content_type")} mono>
              {current.content_type}
            </Detail>
            <Detail label={t("custom_apps:release.uploaded_by")}>{describeUploader(current.uploaded_by, t)}</Detail>
            <Detail label={t("custom_apps:release.uploaded_at")}>{formatDateTime(current.created_at, language)}</Detail>
            <Detail label={t("custom_apps:release.published_at")}>
              {current.published_at &&
                `${formatDateTime(current.published_at, language)}${current.published_by ? ` · ${current.published_by}` : ""}`}
            </Detail>
            <Detail label={t("custom_apps:release.status_changed_at")}>{formatDateTime(current.status_changed_at, language)}</Detail>
            <Detail label={t("custom_apps:release.min_version")} mono>
              {current.min_version}
            </Detail>
          </DetailList>
          <div className="mt-6 grid gap-4 border-t border-neutral-800 pt-5">
            {[
              {label: t("custom_apps:release.sha256"), value: current.sha256},
              {label: t("custom_apps:release.signature"), value: current.signature},
            ].map((entry) => (
              <div key={entry.label} className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{entry.label}</span>
                <CopyField value={entry.value} label={entry.label} />
              </div>
            ))}
            <p className="text-[12px] leading-relaxed text-neutral-500">{t("custom_apps:release.signature_hint")}</p>
          </div>
        </Panel>

        <ReleaseReports releaseId={current.id} version={reportsVersion} />
      </div>

      <RolloutDialog
        release={current}
        mode={rollout ?? "rollout"}
        open={rollout !== null}
        installations={installations.data?.data ?? []}
        installationsLoading={installations.loading}
        onClose={() => setRollout(null)}
        onDone={(next) => {
          notify(rollout === "publish" ? t("custom_apps:release.done.publish") : t("custom_apps:release.done.rollout"));
          setRollout(null);
          take(next);
        }}
      />

      <ReasonDialog
        open={reasonAction !== null}
        title={reasonAction ? reasonCopy[reasonAction].title : ""}
        body={reasonAction ? reasonCopy[reasonAction].body : ""}
        formHelp={reasonAction ? help.form(`release.form_help_${reasonAction}`) : undefined}
        confirmLabel={reasonAction ? reasonCopy[reasonAction].confirm : ""}
        danger={reasonAction ? reasonCopy[reasonAction].danger : false}
        pending={act.pending}
        error={act.error}
        onConfirm={(reason) => void confirmReason(reason)}
        onClose={() => setReasonAction(null)}
      />

      <ConfirmDialog
        open={askDelete}
        title={t("custom_apps:release.delete_title")}
        body={t("custom_apps:release.delete_body", {version: current.version, filename: current.filename})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("custom_apps:release.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />

      <Modal
        open={editing}
        onClose={update.pending ? () => undefined : () => setEditing(false)}
        title={t("custom_apps:release.edit_title", {version: current.version})}
        className="max-w-lg"
        help={help.form("release.edit_form_help")}
      >
        <form onSubmit={saveEdit} className="flex flex-col gap-5" noValidate>
          <Field
            label={t("custom_apps:release.notes_title")}
            htmlFor="release-notes"
            hint={t("custom_apps:release.notes_hint")}
            help={help.field("release.help.notes")}
          >
            <Textarea
              id="release-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={NOTES_MAX}
              rows={8}
              disabled={update.pending}
              className="resize-y"
            />
          </Field>
          <Field
            label={t("custom_apps:release.min_version")}
            htmlFor="release-min-version"
            help={help.field("release.help.min_version")}
            error={minVersionError ?? undefined}
            hint={t("custom_apps:release.min_version_hint", {version: current.version})}
          >
            <Input
              id="release-min-version"
              value={minVersion}
              onChange={(event) => {
                setMinVersion(event.target.value);
                setMinVersionError(null);
              }}
              placeholder="1.0.0"
              maxLength={64}
              disabled={update.pending}
              aria-invalid={Boolean(minVersionError)}
              autoComplete="off"
              className="font-mono"
            />
          </Field>
          {update.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${update.error}`, {defaultValue: update.error})}
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={update.pending}>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={update.pending}>
              {update.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
              {t("admin:common.save")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
