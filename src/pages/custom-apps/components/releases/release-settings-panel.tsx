import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatDuration} from "@/lib/custom-apps/format.ts";
import {UPDATE_SETTINGS} from "@/lib/custom-apps/types.ts";
import type {App, AppPayload} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {Snippet} from "@/pages/custom-apps/components/releases/ci-upload-help.tsx";
import {KEYGEN_SNIPPET, isReleasePublicKey} from "@/pages/custom-apps/components/releases/release-format.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {FormHelpButton, RequiredLegend} from "@/components/ui/help.tsx";

type Form = {
  key: string;
  /** Kept as text so a field can be emptied mid-edit. */
  healthTimeout: string;
  maxFailures: string;
  pauseRollback: string;
  pauseCrash: string;
};

type Errors = Partial<Record<keyof Form, string>>;

const formOf = (app: App): Form => ({
  key: app.release_public_key ?? "",
  healthTimeout: String(app.update_health_timeout_seconds ?? UPDATE_SETTINGS.healthTimeout.default),
  maxFailures: String(app.update_max_failures ?? UPDATE_SETTINGS.maxFailures.default),
  pauseRollback: String(app.rollout_pause_rollback_percent ?? UPDATE_SETTINGS.pauseRollbackPercent.default),
  pauseCrash: String(app.rollout_pause_crash_percent ?? UPDATE_SETTINGS.pauseCrashPercent.default),
});

const NUMBER_FIELDS = [
  {key: "healthTimeout", payload: "update_health_timeout_seconds", bounds: UPDATE_SETTINGS.healthTimeout},
  {key: "maxFailures", payload: "update_max_failures", bounds: UPDATE_SETTINGS.maxFailures},
  {key: "pauseRollback", payload: "rollout_pause_rollback_percent", bounds: UPDATE_SETTINGS.pauseRollbackPercent},
  {key: "pauseCrash", payload: "rollout_pause_crash_percent", bounds: UPDATE_SETTINGS.pauseCrashPercent},
] as const;

/**
 * The app's side of the updater: the public key every upload is verified against, and the numbers
 * the rollout is run by — how long a device waits for the new version to come up healthy, how many
 * failed attempts it makes, and the rollback and crash rates at which a rollout pauses itself.
 *
 * Replacing or removing the key asks first. The same public key is built into the app so its
 * updater can verify what it downloads, so a new key is only safe once a build carrying it is out —
 * and with no key at all, CI cannot upload anything.
 */
export const ReleaseSettingsPanel = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {notify} = useToast();
  const {app, replace} = useApp();

  const baseline = useMemo(() => formOf(app), [app]);
  const [form, setForm] = useState<Form>(baseline);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmKey, setConfirmKey] = useState<AppPayload | null>(null);
  useEffect(() => setForm(baseline), [baseline]);

  const save = useMutation(useCallback((body: AppPayload) => customAppsApi.apps.update(app.id, body), [app.id]));

  const changes = useMemo(() => {
    const body: AppPayload = {};
    const key = form.key.trim();
    if (key !== baseline.key.trim()) body.release_public_key = key || null;
    for (const field of NUMBER_FIELDS) {
      if (form[field.key].trim() !== baseline[field.key]) body[field.payload] = Number(form[field.key]);
    }
    return body;
  }, [form, baseline]);
  const dirty = Object.keys(changes).length > 0;

  const set = (key: keyof Form, value: string) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const send = async (body: AppPayload) => {
    const outcome = await save.run(body);
    if (!outcome.ok) return false;
    notify(t("admin:common.saved"));
    replace(outcome.data);
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = {};
    const key = form.key.trim();
    if (key && !isReleasePublicKey(key)) found.key = t("custom_apps:release_settings.key_invalid");
    for (const field of NUMBER_FIELDS) {
      const value = Number(form[field.key]);
      if (!Number.isInteger(value) || value < field.bounds.min || value > field.bounds.max) {
        found[field.key] = t("custom_apps:rules.range", {min: field.bounds.min, max: field.bounds.max});
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !dirty) return;

    /* Setting the first key is harmless; replacing or removing one is not. */
    if (changes.release_public_key !== undefined && baseline.key) {
      save.reset();
      setConfirmKey(changes);
      return;
    }
    await send(changes);
  };

  const hasKey = Boolean(app.release_public_key);
  const timeout = Number(form.healthTimeout);

  return (
    <>
      <form onSubmit={submit} noValidate>
        <Panel
          title={t("custom_apps:release_settings.title")}
          description={t("custom_apps:release_settings.description")}
          action={
            <>
              <FormHelpButton help={help.form("release_settings.form_help")} />
              {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
              <Button type="submit" size="sm" disabled={save.pending || !dirty}>
                {save.pending ? <Spinner size={14} /> : <FloppyDisk size={14} />}
                {t("admin:common.save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-5">
            {save.error && !confirmKey && (
              <Alert tone="error" title={t("admin:common.failed")}>
                {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
              </Alert>
            )}

            {!hasKey && (
              <Alert tone="info" title={t("custom_apps:release_settings.no_key_title")}>
                {t("custom_apps:release_settings.no_key_body")}
              </Alert>
            )}

            <RequiredLegend />

            <Field
              label={t("custom_apps:release_settings.key")}
              htmlFor="release-key"
              help={help.field("release_settings.help.key")}
              error={errors.key}
              hint={t("custom_apps:release_settings.key_hint")}
            >
              <Textarea
                id="release-key"
                value={form.key}
                rows={2}
                onChange={(event) => set("key", event.target.value)}
                placeholder={t("custom_apps:release_settings.key_placeholder")}
                spellCheck={false}
                autoComplete="off"
                disabled={save.pending}
                aria-invalid={Boolean(errors.key)}
                className="resize-y font-mono text-[13px]"
              />
            </Field>

            <details className="group rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3">
              <summary className="cursor-pointer text-[13px] text-neutral-400 transition-colors hover:text-text">
                {t("custom_apps:release_settings.key_how")}
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-neutral-400">{t("custom_apps:release_settings.key_how_body")}</p>
                <Snippet value={KEYGEN_SNIPPET} label={t("custom_apps:release_settings.key_how")} />
              </div>
            </details>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("custom_apps:release_settings.health_timeout")}
                htmlFor="release-health-timeout"
                required
              help={help.field("release_settings.help.health_timeout")}
                error={errors.healthTimeout}
                hint={
                  Number.isFinite(timeout) && timeout > 0
                    ? t("custom_apps:release_settings.health_timeout_hint", {duration: formatDuration(timeout)})
                    : undefined
                }
              >
                <Input
                  id="release-health-timeout"
                  type="number"
                  inputMode="numeric"
                  min={UPDATE_SETTINGS.healthTimeout.min}
                  max={UPDATE_SETTINGS.healthTimeout.max}
                  value={form.healthTimeout}
                  onChange={(event) => set("healthTimeout", event.target.value)}
                  disabled={save.pending}
                  aria-invalid={Boolean(errors.healthTimeout)}
                  className="font-mono"
                />
              </Field>
              <Field
                label={t("custom_apps:release_settings.max_failures")}
                htmlFor="release-max-failures"
                required
              help={help.field("release_settings.help.max_failures")}
                error={errors.maxFailures}
                hint={t("custom_apps:release_settings.max_failures_hint")}
              >
                <Input
                  id="release-max-failures"
                  type="number"
                  inputMode="numeric"
                  min={UPDATE_SETTINGS.maxFailures.min}
                  max={UPDATE_SETTINGS.maxFailures.max}
                  value={form.maxFailures}
                  onChange={(event) => set("maxFailures", event.target.value)}
                  disabled={save.pending}
                  aria-invalid={Boolean(errors.maxFailures)}
                  className="font-mono"
                />
              </Field>
              <Field
                label={t("custom_apps:release_settings.pause_rollback")}
                htmlFor="release-pause-rollback"
                required
              help={help.field("release_settings.help.pause_rollback")}
                error={errors.pauseRollback}
                hint={t("custom_apps:release_settings.pause_rollback_hint")}
              >
                <Input
                  id="release-pause-rollback"
                  type="number"
                  inputMode="numeric"
                  min={UPDATE_SETTINGS.pauseRollbackPercent.min}
                  max={UPDATE_SETTINGS.pauseRollbackPercent.max}
                  value={form.pauseRollback}
                  onChange={(event) => set("pauseRollback", event.target.value)}
                  disabled={save.pending}
                  aria-invalid={Boolean(errors.pauseRollback)}
                  className="font-mono"
                />
              </Field>
              <Field
                label={t("custom_apps:release_settings.pause_crash")}
                htmlFor="release-pause-crash"
                required
              help={help.field("release_settings.help.pause_crash")}
                error={errors.pauseCrash}
                hint={t("custom_apps:release_settings.pause_crash_hint")}
              >
                <Input
                  id="release-pause-crash"
                  type="number"
                  inputMode="numeric"
                  min={UPDATE_SETTINGS.pauseCrashPercent.min}
                  max={UPDATE_SETTINGS.pauseCrashPercent.max}
                  value={form.pauseCrash}
                  onChange={(event) => set("pauseCrash", event.target.value)}
                  disabled={save.pending}
                  aria-invalid={Boolean(errors.pauseCrash)}
                  className="font-mono"
                />
              </Field>
            </div>
            <p className="text-[12px] leading-relaxed text-neutral-500">
              {t("custom_apps:release_settings.pause_sample")}
            </p>
          </div>
        </Panel>
      </form>

      <ConfirmDialog
        open={confirmKey !== null}
        title={
          confirmKey?.release_public_key === null
            ? t("custom_apps:release_settings.clear_title")
            : t("custom_apps:release_settings.replace_title")
        }
        body={
          confirmKey?.release_public_key === null
            ? t("custom_apps:release_settings.clear_body")
            : t("custom_apps:release_settings.replace_body")
        }
        confirmLabel={
          confirmKey?.release_public_key === null
            ? t("custom_apps:release_settings.clear_confirm")
            : t("custom_apps:release_settings.replace_confirm")
        }
        pending={save.pending}
        error={save.error}
        onClose={() => setConfirmKey(null)}
        onConfirm={() => {
          if (!confirmKey) return;
          void send(confirmKey).then((ok) => {
            if (ok) setConfirmKey(null);
          });
        }}
      />
    </>
  );
};
