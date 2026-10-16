import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {fromDateTimeLocal, orNull, toDateTimeLocal} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {AppState, AppStatusPayload} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {StateBadge} from "@/pages/custom-apps/components/badges.tsx";

const MESSAGE_MAX = 500;

/**
 * The kill switch: what every installation of this app is told on its next heartbeat.
 *
 * Four states, and each one is a promise to the client app about what to do — carry on, warn that
 * the end is near, show a maintenance screen, or stop. A message and an end date ride along so the
 * app can say why and until when. Suspending is the one that stops somebody's work, so it is the one
 * that asks first; lifting it does not, because getting people back to work should not need a
 * second click.
 *
 * Grace is the one state with a deadline the service enforces: it needs an end in the future, at
 * most `grace_max_days` ahead, and when that passes the service suspends the app by itself. The form
 * checks the same bounds before sending so the refusal is a sentence beside the field rather than a
 * 400 above the form.
 */
export const AppStatus = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {app, replace} = useApp();
  const {notify} = useToast();
  const {states, heartbeat, graceMaxDays} = useServiceVocabulary();

  const [state, setState] = useState<AppState>(app.state);
  const [message, setMessage] = useState(app.state_message ?? "");
  const [until, setUntil] = useState(toDateTimeLocal(app.state_until));
  const [confirming, setConfirming] = useState(false);
  const [untilError, setUntilError] = useState<string | null>(null);

  /* A save elsewhere (or this one) resets the form to what the service now holds. */
  useEffect(() => {
    setState(app.state);
    setMessage(app.state_message ?? "");
    setUntil(toDateTimeLocal(app.state_until));
    setUntilError(null);
  }, [app.state, app.state_message, app.state_until]);

  /* Recomputed on every render, which is often enough: the bounds move by the minute. */
  const now = new Date();
  const graceLimit = new Date(now.getTime() + graceMaxDays * 86_400_000);

  const checkUntil = () => {
    if (state !== "grace") return null;
    const end = fromDateTimeLocal(until);
    if (!end) return t("custom_apps:status.grace_required");
    const time = new Date(end).getTime();
    if (time <= Date.now()) return t("custom_apps:status.grace_past");
    if (time > Date.now() + graceMaxDays * 86_400_000) return t("custom_apps:status.grace_too_far", {count: graceMaxDays});
    return null;
  };

  const save = useMutation(useCallback((body: AppStatusPayload) => customAppsApi.apps.setStatus(app.id, body), [app.id]));

  const dirty =
    state !== app.state || message !== (app.state_message ?? "") || until !== toDateTimeLocal(app.state_until);

  const persist = async () => {
    const outcome = await save.run({
      state,
      /* An active app has nothing to explain; leaving a stale message on it would be shown the next
         time it is put in grace. */
      message: state === "active" ? null : orNull(message),
      until: state === "active" ? null : fromDateTimeLocal(until),
    });
    if (!outcome.ok) return;
    setConfirming(false);
    replace(outcome.data);
    notify(t("custom_apps:status.saved"));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = checkUntil();
    setUntilError(problem);
    if (problem) return;
    if (state === "suspended" && app.state !== "suspended") {
      save.reset();
      setConfirming(true);
      return;
    }
    void persist();
  };

  return (
    <>
      <form onSubmit={submit} noValidate>
        <Panel
          title={t("custom_apps:status.title")}
          description={t("custom_apps:status.description", {interval: app.heartbeat_interval_seconds || heartbeat.default})}
          action={<StateBadge state={app.state} />}
        >
          <div className="flex flex-col gap-5">
            {save.error && !confirming && (
              <Alert tone="error" title={t("admin:common.failed")}>
                {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
              </Alert>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-neutral-300">{t("custom_apps:status.state")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {states.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 transition-colors",
                      state === option
                        ? option === "suspended"
                          ? "border-red-500/60 bg-red-500/10"
                          : "border-accent-700 bg-accent-900/30"
                        : "border-neutral-800 hover:border-neutral-700",
                    )}
                  >
                    <input
                      type="radio"
                      name="app-state"
                      value={option}
                      checked={state === option}
                      onChange={() => {
                        setState(option);
                        setUntilError(null);
                      }}
                      disabled={save.pending}
                      className="mt-1 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0">
                      <StateBadge state={option} />
                      <span className="mt-1.5 block text-[13px] leading-relaxed text-neutral-400">
                        {t(`custom_apps:status.explain.${option}`, {defaultValue: ""})}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {state !== "active" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={t("custom_apps:status.message")}
                  htmlFor="status-message"
                  hint={t("custom_apps:status.message_hint", {count: message.length, max: MESSAGE_MAX})}
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="status-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    maxLength={MESSAGE_MAX}
                    disabled={save.pending}
                    placeholder={t(`custom_apps:status.message_placeholder.${state}`, {defaultValue: ""})}
                    className="resize-y"
                  />
                </Field>

                <Field
                  label={state === "grace" ? t("custom_apps:status.until_grace") : t("custom_apps:status.until")}
                  htmlFor="status-until"
                  hint={
                    state === "grace"
                      ? t("custom_apps:status.until_hint_grace", {count: graceMaxDays})
                      : t("custom_apps:status.until_hint")
                  }
                  error={untilError}
                >
                  <Input
                    id="status-until"
                    type="datetime-local"
                    value={until}
                    min={state === "grace" ? toDateTimeLocal(now.toISOString()) : undefined}
                    max={state === "grace" ? toDateTimeLocal(graceLimit.toISOString()) : undefined}
                    required={state === "grace"}
                    aria-invalid={Boolean(untilError)}
                    onChange={(event) => {
                      setUntil(event.target.value);
                      setUntilError(null);
                    }}
                    disabled={save.pending}
                  />
                </Field>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-neutral-600">
                {t("custom_apps:updated_at", {date: formatDateTime(app.updated_at, i18n.language)})}
              </p>
              <div className="flex items-center gap-3">
                {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
                <Button type="submit" disabled={save.pending || !dirty}>
                  {save.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
                  {t("custom_apps:status.apply")}
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      </form>

      {/* Outside the form: its buttons are plain buttons, and inside one they would submit it. */}
      <ConfirmDialog
        open={confirming}
        title={t("custom_apps:status.suspend_title")}
        body={t("custom_apps:status.suspend_body", {name: app.name, count: app.installation_count})}
        confirmLabel={t("custom_apps:status.suspend_confirm")}
        onConfirm={() => void persist()}
        onClose={() => setConfirming(false)}
        pending={save.pending}
        error={save.error}
      />
    </>
  );
};
