import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {CheckCircle, FloppyDisk, PencilSimple, Prohibit} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatDuration, formatLastSeen} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {AppState, Channel, Installation, InstallationPayload, LogLevel} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {OpenAlertsHint} from "@/pages/custom-apps/components/alerts/open-alerts-hint.tsx";
import {ConnectedIndicator, LifecycleBadge, ReviewBadge, SocketBadge, StateBadge} from "@/pages/custom-apps/components/badges.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {InstallationDaily} from "@/pages/custom-apps/components/installation-daily.tsx";
import {InstallationEvents} from "@/pages/custom-apps/components/installation-events.tsx";
import {InstallationHeartbeats} from "@/pages/custom-apps/components/installation-heartbeats.tsx";
import {describePlatform, installationLabel} from "@/pages/custom-apps/components/installation-label.ts";
import {InstallationMetrics} from "@/pages/custom-apps/components/installation-metrics.tsx";
import {LogsPanel} from "@/pages/custom-apps/components/logs/logs-panel.tsx";
import {InstallationCommands} from "@/pages/custom-apps/components/remote/installation-commands.tsx";
import {InstallationScreenshots} from "@/pages/custom-apps/components/remote/installation-screenshots.tsx";
import {SnapshotCards} from "@/pages/custom-apps/components/snapshot-cards.tsx";

const REFRESH_MS = 15_000;
const ALIAS_MAX = 80;
const MESSAGE_MAX = 500;

type Controls = {
  channel: Channel;
  override: "" | AppState;
  message: string;
  /** Empty follows the app's level. */
  logLevel: "" | LogLevel;
  screenshots: boolean;
};

const EMPTY_CONTROLS: Controls = {channel: "stable", override: "", message: "", logLevel: "", screenshots: false};

const controlsOf = (installation: Installation): Controls => ({
  channel: installation.channel,
  override: installation.state_override ?? "",
  message: installation.state_message ?? "",
  logLevel: installation.log_level_override ?? "",
  screenshots: installation.screenshots_enabled ?? false,
});

/**
 * One device an app is installed on: what it is, what it is doing right now, and what it did.
 *
 * The record — and with it the live snapshot and the connected dot — refreshes every fifteen
 * seconds while the tab is visible; the charts and tables below it do not, because history does not
 * change under a reader the way "now" does, and redrawing a chart somebody is hovering would be
 * worse than a minute-old line.
 *
 * The app is loaded beside the installation, because the remote-operation panels follow its
 * modules — commands and screenshots only with `commands`, the log only with `logs` — and the
 * command catalogue depends on its kind (only a kiosk restarts the device).
 */
export const InstallationDetail = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {installationId = ""} = useParams<{installationId: string}>();
  const {notify} = useToast();
  const {states, channels, logLevels} = useServiceVocabulary();
  const language = i18n.language;

  const record = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.installations.get(installationId, signal), [installationId]),
  );
  useAutoRefresh(record.reload, REFRESH_MS);

  const [installation, setInstallation] = useState<Installation | null>(null);
  useEffect(() => {
    if (record.data) setInstallation(record.data);
  }, [record.data]);

  const [controls, setControls] = useState<Controls>(EMPTY_CONTROLS);
  const [baseline, setBaseline] = useState<Controls>(EMPTY_CONTROLS);
  const [screenshotVersion, setScreenshotVersion] = useState(0);
  const onScreenshot = useCallback(() => setScreenshotVersion((value) => value + 1), []);

  const appId = installation && installation.id === installationId ? installation.app_id : "";
  const appRecord = useResource(
    useCallback((signal: AbortSignal) => (appId ? customAppsApi.apps.get(appId, signal) : Promise.resolve(null)), [appId]),
  );
  const app = appRecord.data && appRecord.data.id === appId ? appRecord.data : null;
  const modules = app?.modules ?? [];
  const [renaming, setRenaming] = useState(false);
  const [alias, setAlias] = useState("");
  const [askRevoke, setAskRevoke] = useState(false);

  /*
   * The form follows the record only when the record's own values moved, not on every poll: a
   * refresh every fifteen seconds must never throw away a half-typed message.
   */
  const recordControls = installation ? JSON.stringify(controlsOf(installation)) : null;
  useEffect(() => {
    if (!recordControls) return;
    const next = JSON.parse(recordControls) as Controls;
    setBaseline(next);
    setControls(next);
  }, [recordControls]);

  const update = useMutation(
    useCallback((body: InstallationPayload) => customAppsApi.installations.update(installationId, body), [installationId]),
  );
  const review = useMutation(useCallback(() => customAppsApi.installations.review(installationId), [installationId]));
  const revoke = useMutation(useCallback(() => customAppsApi.installations.revoke(installationId), [installationId]));

  const current = installation && installation.id === installationId ? installation : null;

  if (!current) {
    return (
      <>
        <PageHeader title={t("custom_apps:installation.loading_title")} back={{to: customAppsRoute.apps, label: t("custom_apps:apps.back")}} />
        <Panel title={t("custom_apps:installation.details")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const revoked = current.status === "revoked";
  const dirty = JSON.stringify(controls) !== JSON.stringify(baseline);

  const saveControls = async (event: FormEvent) => {
    event.preventDefault();
    const body: InstallationPayload = {};
    if (controls.channel !== baseline.channel) body.channel = controls.channel;
    if (controls.logLevel !== baseline.logLevel) body.log_level_override = controls.logLevel || null;
    if (controls.screenshots !== baseline.screenshots) body.screenshots_enabled = controls.screenshots;
    if (controls.override !== baseline.override || controls.message !== baseline.message) {
      body.state_override = controls.override || null;
      /* No override, nothing to explain: the app's own message is what the device shows then. */
      body.state_message = controls.override === "" ? null : orNull(controls.message);
    }
    const outcome = await update.run(body);
    if (!outcome.ok) return;
    setInstallation(outcome.data);
    notify(t("admin:common.saved"));
  };

  const saveAlias = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await update.run({alias: orNull(alias)});
    if (!outcome.ok) return;
    setInstallation(outcome.data);
    setRenaming(false);
    notify(t("custom_apps:installation.renamed"));
  };

  const markReviewed = async () => {
    const outcome = await review.run();
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    setInstallation(outcome.data);
    notify(t("custom_apps:installation.reviewed"));
  };

  const confirmRevoke = async () => {
    const outcome = await revoke.run();
    if (!outcome.ok) return;
    setInstallation(outcome.data);
    setAskRevoke(false);
    notify(t("custom_apps:installation.revoked"));
  };

  const appLink = customAppsRoute.appInstallations(current.app_id);
  const version = current.app_version
    ? current.previous_app_version && current.previous_app_version !== current.app_version
      ? t("custom_apps:installation.version_upgraded", {version: current.app_version, previous: current.previous_app_version})
      : current.app_version
    : null;

  return (
    <>
      <PageHeader
        title={installationLabel(current)}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ConnectedIndicator connected={current.connected && !revoked} />
            {current.socket_connected && !revoked && <SocketBadge />}
            <span className="text-neutral-700" aria-hidden="true">·</span>
            <span>
              {current.last_seen_at
                ? t("custom_apps:installations.seen_ago", {when: formatLastSeen(current.last_seen_at, language)})
                : t("custom_apps:installations.never_seen")}
            </span>
            <StateBadge state={current.effective_state} />
            {revoked ? <LifecycleBadge status="revoked" /> : current.needs_review ? <ReviewBadge /> : null}
            {current.app && (
              <Link to={customAppsRoute.app(current.app.id)} className="hover:text-text hover:underline">
                {current.app.name}
              </Link>
            )}
          </span>
        }
        back={{to: appLink, label: t("custom_apps:installation.back")}}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                update.reset();
                setAlias(current.alias ?? "");
                setRenaming(true);
              }}
            >
              <PencilSimple size={16} /> {t("custom_apps:installation.rename")}
            </Button>
            {!revoked && (
              <Button
                variant="secondary"
                onClick={() => {
                  revoke.reset();
                  setAskRevoke(true);
                }}
                className="border-red-500/50 text-red-300 fs-ripple-danger"
              >
                <Prohibit size={16} /> {t("custom_apps:installation.revoke")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <OpenAlertsHint installationId={current.id} />

        {revoked && (
          <Alert tone="error" title={t("custom_apps:installation.revoked_title")}>
            {t("custom_apps:installation.revoked_body", {
              date: formatDateTime(current.revoked_at, language) ?? "—",
              by: current.revoked_by ?? "—",
            })}
          </Alert>
        )}

        {!revoked && current.needs_review && (
          <Alert tone="info" title={t("custom_apps:installation.review_title")}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{t("custom_apps:installation.review_body")}</span>
              <Button size="sm" onClick={() => void markReviewed()} disabled={review.pending}>
                {review.pending ? <Spinner size={14} /> : <CheckCircle size={14} />}
                {t("custom_apps:installation.mark_reviewed")}
              </Button>
            </div>
          </Alert>
        )}

        <Panel
          title={t("custom_apps:snapshot.title")}
          description={
            current.last_seen_at
              ? t("custom_apps:snapshot.description", {when: formatDateTime(current.last_seen_at, language)})
              : t("custom_apps:snapshot.never")
          }
        >
          <SnapshotCards snapshot={current.last_snapshot} />
        </Panel>

        <InstallationMetrics installationId={current.id} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title={t("custom_apps:installation.details")}>
            <DetailList className="lg:grid-cols-2">
              <Detail label={t("custom_apps:installation.platform")}>
                {[t(`custom_apps:platforms.${current.platform}`, {defaultValue: current.platform}), describePlatform(current)]
                  /* "Windows · Windows 11" says the same word twice; the OS line alone is enough then. */
                  .filter((part, index, parts) => part && !(index === 0 && parts[1]?.startsWith(part)))
                  .join(" · ")}
              </Detail>
              <Detail label={t("custom_apps:installation.arch")} mono>
                {current.arch}
              </Detail>
              <Detail label={t("custom_apps:installation.hostname")} mono>
                {current.hostname}
              </Detail>
              <Detail label={t("custom_apps:installation.version")} mono>
                {version}
              </Detail>
              <Detail label={t("custom_apps:installation.device_id")} mono>
                {current.device_id}
              </Detail>
              <Detail label={t("custom_apps:installation.heartbeat")}>
                {t("custom_apps:summary.every", {interval: formatDuration(current.heartbeat_interval_seconds)})}
              </Detail>
              <Detail label={t("custom_apps:installation.enrolled")}>
                {formatDateTime(current.enrolled_at, language)}
                {current.enrolled_ip && <span className="font-mono text-[12px] text-neutral-500"> · {current.enrolled_ip}</span>}
              </Detail>
              <Detail label={t("custom_apps:installation.last_ip")} mono>
                {current.last_ip}
              </Detail>
              <Detail label={t("custom_apps:installation.user_agent")}>
                {current.user_agent && <span title={current.user_agent}>{describeUserAgent(current.user_agent)}</span>}
              </Detail>
              <Detail label={t("custom_apps:installation.reviewed_at")}>
                {current.reviewed_at &&
                  `${formatDateTime(current.reviewed_at, language)}${current.reviewed_by ? ` · ${current.reviewed_by}` : ""}`}
              </Detail>
              <Detail label={t("custom_apps:installation.access_expires")}>
                {formatDateTime(current.access_token_expires_at, language)}
              </Detail>
              <Detail label={t("custom_apps:installation.refresh_expires")}>
                {formatDateTime(current.refresh_token_expires_at, language)}
              </Detail>
            </DetailList>
          </Panel>

          <form onSubmit={saveControls} noValidate>
            <Panel title={t("custom_apps:installation.controls")} description={t("custom_apps:installation.controls_hint")}>
              <div className="flex flex-col gap-5">
                {update.error && !renaming && (
                  <Alert tone="error" title={t("admin:common.failed")}>
                    {t(`admin:errors.${update.error}`, {defaultValue: update.error})}
                  </Alert>
                )}

                <Field label={t("custom_apps:installation.channel")} htmlFor="installation-channel" hint={t("custom_apps:installation.channel_hint")}>
                  <Select
                    id="installation-channel"
                    value={controls.channel}
                    disabled={revoked || update.pending}
                    onChange={(event) => setControls((value) => ({...value, channel: event.target.value as Channel}))}
                  >
                    {channels.map((channel) => (
                      <option key={channel} value={channel}>
                        {t(`custom_apps:channels.${channel}`, {defaultValue: channel})}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label={t("custom_apps:installation.override")} htmlFor="installation-override" hint={t("custom_apps:installation.override_hint")}>
                  <Select
                    id="installation-override"
                    value={controls.override}
                    disabled={revoked || update.pending}
                    onChange={(event) => setControls((value) => ({...value, override: event.target.value as "" | AppState}))}
                  >
                    <option value="">{t("custom_apps:installation.override_none")}</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {t(`custom_apps:states.${state}`, {defaultValue: state})}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label={t("custom_apps:installation.log_level")}
                  htmlFor="installation-log-level"
                  hint={t("custom_apps:installation.log_level_hint", {
                    level: t(`custom_apps:log_levels.${current.effective_log_level}`, {
                      defaultValue: current.effective_log_level ?? "",
                    }),
                  })}
                >
                  <Select
                    id="installation-log-level"
                    value={controls.logLevel}
                    disabled={revoked || update.pending}
                    onChange={(event) => setControls((value) => ({...value, logLevel: event.target.value as "" | LogLevel}))}
                  >
                    <option value="">
                      {app
                        ? t("custom_apps:installation.log_level_follow_value", {
                            level: t(`custom_apps:log_levels.${app.log_level}`, {defaultValue: app.log_level ?? ""}),
                          })
                        : t("custom_apps:installation.log_level_follow")}
                    </option>
                    {logLevels.map((level) => (
                      <option key={level} value={level}>
                        {t(`custom_apps:log_levels.${level}`, {defaultValue: level})}
                      </option>
                    ))}
                  </Select>
                </Field>

                <label
                  htmlFor="installation-screenshots"
                  className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-neutral-800 px-3 py-2.5 transition-colors hover:border-neutral-700"
                >
                  <input
                    id="installation-screenshots"
                    type="checkbox"
                    checked={controls.screenshots}
                    disabled={revoked || update.pending}
                    onChange={(event) => setControls((value) => ({...value, screenshots: event.target.checked}))}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-text">{t("custom_apps:installation.screenshots")}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                      {app && !app.screenshots_enabled
                        ? t("custom_apps:installation.screenshots_app_off")
                        : t("custom_apps:installation.screenshots_hint")}
                    </span>
                  </span>
                </label>

                {controls.override !== "" && (
                  <Field label={t("custom_apps:status.message")} htmlFor="installation-message">
                    <Textarea
                      id="installation-message"
                      value={controls.message}
                      maxLength={MESSAGE_MAX}
                      rows={3}
                      disabled={revoked || update.pending}
                      onChange={(event) => setControls((value) => ({...value, message: event.target.value}))}
                      className="resize-y"
                    />
                  </Field>
                )}

                <div className="flex items-center justify-end gap-3">
                  {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
                  <Button type="submit" disabled={revoked || update.pending || !dirty}>
                    {update.pending && !renaming ? <Spinner size={16} /> : <FloppyDisk size={16} />}
                    {t("admin:common.save")}
                  </Button>
                </div>
              </div>
            </Panel>
          </form>
        </div>

        {modules.includes("commands") && (
          <>
            <InstallationCommands installation={current} app={app} onScreenshot={onScreenshot} />
            <InstallationScreenshots
              installation={current}
              appAllows={app ? app.screenshots_enabled : null}
              version={screenshotVersion}
            />
          </>
        )}

        {modules.includes("logs") && <LogsPanel scope={{kind: "installation", installationId: current.id}} />}

        <InstallationDaily installationId={current.id} />
        <InstallationEvents installationId={current.id} />
        <InstallationHeartbeats installationId={current.id} />
      </div>

      <Modal
        open={renaming}
        onClose={update.pending ? () => undefined : () => setRenaming(false)}
        title={t("custom_apps:installation.rename_title")}
        className="max-w-md"
      >
        <form onSubmit={saveAlias} className="flex flex-col gap-5" noValidate>
          <Field label={t("custom_apps:installation.alias")} htmlFor="installation-alias" hint={t("custom_apps:installation.alias_hint")}>
            <Input
              id="installation-alias"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              maxLength={ALIAS_MAX}
              placeholder={current.hostname ?? current.device_id}
              autoComplete="off"
            />
          </Field>
          {update.error && renaming && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${update.error}`, {defaultValue: update.error})}
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenaming(false)} disabled={update.pending}>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={update.pending}>
              {update.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
              {t("admin:common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={askRevoke}
        title={t("custom_apps:installation.revoke_title")}
        body={t("custom_apps:installation.revoke_body", {name: installationLabel(current)})}
        confirmLabel={revoke.pending ? t("custom_apps:installation.revoking") : t("custom_apps:installation.revoke")}
        onConfirm={() => void confirmRevoke()}
        onClose={() => setAskRevoke(false)}
        pending={revoke.pending}
        error={revoke.error}
      />
    </>
  );
};
