import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {
  WINDOW_BOUNDS,
  defaultThreshold,
  thresholdBounds,
  thresholdUnit,
  usesWindow,
} from "@/lib/custom-apps/alerts.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {AlertKind, AlertRule} from "@/lib/custom-apps/types.ts";
import {AppSelect} from "@/pages/custom-apps/components/alerts/app-select.tsx";

const NAME_MAX = 120;

export type RuleDraft = {mode: "create"; appId?: string} | {mode: "edit"; rule: AlertRule};

type Form = {appId: string; name: string; kind: AlertKind; threshold: string; window: string; enabled: boolean};

const formOf = (draft: RuleDraft): Form =>
  draft.mode === "edit"
    ? {
        appId: draft.rule.app_id ?? "",
        name: draft.rule.name,
        kind: draft.rule.kind,
        threshold: String(draft.rule.threshold),
        window: String(draft.rule.window_minutes || WINDOW_BOUNDS.default),
        enabled: draft.rule.enabled,
      }
    : {
        appId: draft.appId ?? "",
        name: "",
        kind: "installation_offline",
        threshold: String(defaultThreshold("installation_offline")),
        window: String(WINDOW_BOUNDS.default),
        enabled: true,
      };

/**
 * Creating a rule, or tuning one. The kind and the app are fixed once a rule exists: a rule that
 * changed what it watches would leave its past alerts describing something it no longer is.
 *
 * Whoever creates the rule is who the notification centre tells when it fires.
 */
export const RuleFormModal = ({
  draft,
  onClose,
  onSaved,
}: {
  draft: RuleDraft | null;
  onClose: () => void;
  onSaved: (rule: AlertRule) => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {alertKinds} = useServiceVocabulary();
  const [form, setForm] = useState<Form>(() => formOf(draft ?? {mode: "create"}));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const save = useMutation(
    useCallback(async (current: RuleDraft, body: Form) => {
      const threshold = Number(body.threshold);
      const windowMinutes = usesWindow(body.kind) ? Number(body.window) : undefined;
      return current.mode === "edit"
        ? customAppsApi.alertRules.update(current.rule.id, {
            name: body.name.trim(),
            threshold,
            window_minutes: windowMinutes,
            enabled: body.enabled,
          })
        : customAppsApi.alertRules.create({
            app_id: body.appId || null,
            name: body.name.trim(),
            kind: body.kind,
            threshold,
            window_minutes: windowMinutes,
            enabled: body.enabled,
          });
    }, []),
  );

  const {reset} = save;
  useEffect(() => {
    if (!draft) return;
    setForm(formOf(draft));
    setErrors({});
    reset();
  }, [draft, reset]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const bounds = thresholdBounds(form.kind);
  const unit = thresholdUnit(form.kind);
  const editing = draft?.mode === "edit";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const found: Partial<Record<keyof Form, string>> = {};
    const name = form.name.trim();
    if (!name) found.name = t("custom_apps:validation.required");
    else if (name.length > NAME_MAX) found.name = t("custom_apps:validation.too_long", {max: NAME_MAX});
    const threshold = Number(form.threshold);
    if (!Number.isFinite(threshold) || threshold < bounds.min || threshold > bounds.max) {
      found.threshold = t("custom_apps:rules.range", {min: bounds.min, max: bounds.max});
    }
    if (usesWindow(form.kind)) {
      const minutes = Number(form.window);
      if (!Number.isInteger(minutes) || minutes < WINDOW_BOUNDS.min || minutes > WINDOW_BOUNDS.max) {
        found.window = t("custom_apps:rules.range", {min: WINDOW_BOUNDS.min, max: WINDOW_BOUNDS.max});
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const outcome = await save.run(draft, form);
    if (!outcome.ok) return;
    onSaved(outcome.data);
  };

  return (
    <Modal
      open={draft !== null}
      onClose={save.pending ? () => undefined : onClose}
      title={editing ? t("custom_apps:rules.edit_title") : t("custom_apps:rules.create_title")}
      className="max-w-lg"
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t("custom_apps:rules.fields.app")} htmlFor="rule-app" hint={t("custom_apps:rules.hints.app")}>
          <AppSelect
            id="rule-app"
            value={form.appId}
            onChange={(value) => set("appId", value)}
            emptyLabel={t("custom_apps:rules.every_app")}
            disabled={editing || save.pending}
          />
        </Field>

        <Field label={t("custom_apps:rules.fields.kind")} htmlFor="rule-kind" hint={t(`custom_apps:alert_kinds_hint.${form.kind}`, {defaultValue: ""})}>
          <Select
            id="rule-kind"
            value={form.kind}
            disabled={editing || save.pending}
            onChange={(event) => {
              const kind = event.target.value as AlertKind;
              set("kind", kind);
              set("threshold", String(defaultThreshold(kind)));
            }}
          >
            {alertKinds.map((kind) => (
              <option key={kind} value={kind}>
                {t(`custom_apps:alert_kinds.${kind}`, {defaultValue: kind})}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("custom_apps:rules.fields.name")} htmlFor="rule-name" error={errors.name}>
          <Input
            id="rule-name"
            value={form.name}
            onChange={(event) => set("name", event.target.value)}
            maxLength={NAME_MAX}
            placeholder={t(`custom_apps:alert_kinds.${form.kind}`, {defaultValue: form.kind})}
            disabled={save.pending}
            aria-invalid={Boolean(errors.name)}
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t(`custom_apps:rules.threshold.${unit}`)}
            htmlFor="rule-threshold"
            error={errors.threshold}
            hint={t(`custom_apps:rules.threshold_hint.${form.kind}`, {defaultValue: t("custom_apps:rules.range", bounds)})}
          >
            <Input
              id="rule-threshold"
              type="number"
              inputMode="numeric"
              min={bounds.min}
              max={bounds.max}
              value={form.threshold}
              onChange={(event) => set("threshold", event.target.value)}
              disabled={save.pending}
              aria-invalid={Boolean(errors.threshold)}
              className="font-mono"
            />
          </Field>

          {usesWindow(form.kind) && (
            <Field
              label={t("custom_apps:rules.fields.window")}
              htmlFor="rule-window"
              error={errors.window}
              hint={t("custom_apps:rules.hints.window", {min: WINDOW_BOUNDS.min, max: WINDOW_BOUNDS.max})}
            >
              <Input
                id="rule-window"
                type="number"
                inputMode="numeric"
                min={WINDOW_BOUNDS.min}
                max={WINDOW_BOUNDS.max}
                value={form.window}
                onChange={(event) => set("window", event.target.value)}
                disabled={save.pending}
                aria-invalid={Boolean(errors.window)}
                className="font-mono"
              />
            </Field>
          )}
        </div>

        <label htmlFor="rule-enabled" className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
          <input
            id="rule-enabled"
            type="checkbox"
            checked={form.enabled}
            disabled={save.pending}
            onChange={(event) => set("enabled", event.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("custom_apps:rules.fields.enabled")}
        </label>

        {!editing && <p className="text-[12px] leading-relaxed text-neutral-500">{t("custom_apps:rules.hints.notify")}</p>}

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
            {save.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
            {editing ? t("admin:common.save") : t("admin:common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
