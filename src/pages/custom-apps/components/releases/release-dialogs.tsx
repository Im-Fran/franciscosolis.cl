import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {RocketLaunch, Warning} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatNumber} from "@/lib/custom-apps/format.ts";
import type {InstallationSummary, ReleaseDetail} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";

const REASON_MAX = 500;
const PRESETS = [1, 10, 25, 50, 100] as const;

/**
 * A confirmation that also asks why. Pausing, withdrawing and rolling back record a reason beside
 * who did it, and the release page shows it afterwards — "paused: printer driver crash on the
 * Lo Barnechea kiosks" is worth more to the next reader than "paused".
 */
export const ReasonDialog = ({
  open,
  title,
  body,
  confirmLabel,
  danger,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Draws the confirm button in the destructive tone. */
  danger?: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string | null) => void;
  onClose: () => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm(reason.trim() || null);
  };

  return (
    <Modal open={open} onClose={pending ? () => undefined : onClose} title={title} className="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="text-sm leading-relaxed text-neutral-300">{body}</div>
        <Field label={t("custom_apps:release.reason")} htmlFor="release-reason" hint={t("custom_apps:release.reason_hint")}>
          <Textarea
            id="release-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REASON_MAX}
            rows={3}
            disabled={pending}
            className="resize-y"
          />
        </Field>
        {error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${error}`, {defaultValue: error})}
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button
            type="submit"
            variant={danger ? "secondary" : "primary"}
            disabled={pending}
            className={danger ? "border-red-500/50 text-red-300 fs-ripple-danger" : undefined}
          >
            {pending ? <Spinner size={16} /> : <Warning size={16} />}
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * Whether an installation is on a release's line, as far as the panel can tell. Channel and platform
 * are compared as they are; the architecture is left to the service, which normalises what each
 * device reported (`arm64` and `aarch64` are one line) — the list shows each device's own.
 */
const onLine = (installation: InstallationSummary, release: ReleaseDetail) =>
  installation.status === "active" && installation.channel === release.channel && installation.platform === release.platform;

/**
 * Publishing a draft, or changing how far a published one reaches: a percentage of the line plus,
 * optionally, named devices offered it whatever the percentage says — the canary kiosks.
 *
 * The percentage picks devices by a stable bucket, so the devices inside 10 % of this release are
 * the ones inside 10 % of the next: the same kiosks are always the canaries. The estimate under the
 * slider is the line times the share, which is what the buckets converge on rather than a count.
 */
export const RolloutDialog = ({
  release,
  mode,
  open,
  installations,
  installationsLoading,
  onClose,
  onDone,
}: {
  release: ReleaseDetail;
  mode: "publish" | "rollout";
  open: boolean;
  installations: InstallationSummary[];
  installationsLoading: boolean;
  onClose: () => void;
  onDone: (release: ReleaseDetail) => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const [percent, setPercent] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const save = useMutation(
    useCallback(
      (body: {rollout_percent: number; installation_ids: string[]}) =>
        mode === "publish" ? customAppsApi.releases.publish(release.id, body) : customAppsApi.releases.rollout(release.id, body),
      [mode, release.id],
    ),
  );

  const {reset} = save;
  useEffect(() => {
    if (!open) return;
    setPercent(mode === "publish" ? 10 : release.rollout_percent);
    setSelected(release.rollout_installations);
    setSearch("");
    reset();
  }, [open, mode, release.rollout_percent, release.rollout_installations, reset]);

  /* The line's devices, plus any named earlier that no longer match it, so none is dropped unseen. */
  const candidates = useMemo(() => {
    const rows = installations.filter((row) => onLine(row, release) || release.rollout_installations.includes(row.id));
    return rows.sort((a, b) => installationLabel(a).localeCompare(installationLabel(b)));
  }, [installations, release]);
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? candidates.filter((row) =>
        [installationLabel(row), row.hostname, row.app_version, row.arch].some((value) => value?.toLowerCase().includes(needle)),
      )
    : candidates;

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => (checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)));

  const estimate = Math.round((release.installations_on_line * percent) / 100);
  const reachesNobody = percent === 0 && selected.length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await save.run({rollout_percent: percent, installation_ids: selected});
    if (!outcome.ok) return;
    onDone(outcome.data);
  };

  return (
    <Modal
      open={open}
      onClose={save.pending ? () => undefined : onClose}
      title={mode === "publish" ? t("custom_apps:release.publish_title", {version: release.version}) : t("custom_apps:release.rollout_title")}
      className="max-w-xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <p className="text-[13px] leading-relaxed text-neutral-400">
          {mode === "publish" ? t("custom_apps:release.publish_body") : t("custom_apps:release.rollout_body")}
        </p>

        <Field label={t("custom_apps:release.percent")} htmlFor="release-percent">
          <div className="flex items-center gap-3">
            <input
              id="release-percent"
              type="range"
              min={0}
              max={100}
              step={1}
              value={percent}
              disabled={save.pending}
              onChange={(event) => setPercent(Number(event.target.value))}
              className="h-2 flex-1 cursor-pointer accent-[var(--color-accent)]"
              aria-valuetext={`${percent} %`}
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={percent}
              disabled={save.pending}
              onChange={(event) => setPercent(Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0))))}
              aria-label={t("custom_apps:release.percent")}
              className="w-20 font-mono"
            />
          </div>
        </Field>
        <div className="-mt-2 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPercent(value)}
              disabled={save.pending}
              className={cn(
                "cursor-pointer rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono text-[12px] transition-colors",
                percent === value ? "border-accent-700 bg-accent-900/40 text-accent-200" : "border-neutral-800 text-neutral-400 hover:text-text",
              )}
            >
              {value} %
            </button>
          ))}
          <span className="ml-auto text-[12px] text-neutral-500">
            {t("custom_apps:release.estimate", {
              count: estimate,
              estimate: formatNumber(estimate, language),
              total: formatNumber(release.installations_on_line, language),
            })}
          </span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-neutral-300">
            {t("custom_apps:release.named")}
            {selected.length > 0 && (
              <span className="ml-2 text-[12px] font-normal text-neutral-500">
                {t("custom_apps:release.named_count", {count: selected.length})}
              </span>
            )}
          </legend>
          <p className="text-[12px] leading-relaxed text-neutral-500">{t("custom_apps:release.named_hint")}</p>
          {candidates.length > 8 && (
            <SearchBox value={search} onChange={setSearch} placeholder={t("custom_apps:release.named_search")} />
          )}
          <div className="max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-neutral-800">
            {installationsLoading ? (
              <p className="px-3 py-3 text-[13px] text-neutral-500">{t("admin:common.loading")}</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-neutral-500">
                {candidates.length === 0 ? t("custom_apps:release.named_empty") : t("custom_apps:no_matches")}
              </p>
            ) : (
              <ul>
                {visible.map((row) => {
                  const id = `release-named-${row.id}`;
                  return (
                    <li key={row.id} className="border-b border-neutral-800/70 last:border-0">
                      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-neutral-800/30">
                        <input
                          id={id}
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          disabled={save.pending}
                          onChange={(event) => toggle(row.id, event.target.checked)}
                          className="size-4 shrink-0 accent-[var(--color-accent)]"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-text">{installationLabel(row)}</span>
                        <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                          {[row.app_version && `v${row.app_version}`, row.arch].filter(Boolean).join(" · ")}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </fieldset>

        {reachesNobody && (
          <Alert tone="info" title={t("custom_apps:release.nobody_title")}>
            {t("custom_apps:release.nobody_body")}
          </Alert>
        )}

        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button type="submit" disabled={save.pending}>
            {save.pending ? <Spinner size={16} /> : <RocketLaunch size={16} />}
            {mode === "publish" ? t("custom_apps:release.publish") : t("custom_apps:release.rollout_apply")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
