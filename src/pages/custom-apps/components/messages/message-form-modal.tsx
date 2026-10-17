import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {fromDateTimeLocal, toDateTimeLocal} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {
  AppMessage,
  InstallationSummary,
  MessageDisplay,
  MessageSeverity,
  NewMessage,
  TargetScope,
} from "@/lib/custom-apps/types.ts";
import {ScopeFields} from "@/pages/custom-apps/components/scope-fields.tsx";

export const TITLE_MAX = 200;
export const BODY_MAX = 4000;

export type MessageDraft = {mode: "create"} | {mode: "edit"; message: AppMessage};

type Form = {
  title: string;
  body: string;
  severity: MessageSeverity;
  display: MessageDisplay;
  scope: TargetScope;
  scopeValue: string;
  startsAt: string;
  endsAt: string;
};

const formOf = (draft: MessageDraft): Form =>
  draft.mode === "edit"
    ? {
        title: draft.message.title,
        body: draft.message.body,
        severity: draft.message.severity,
        display: draft.message.display,
        scope: draft.message.scope,
        scopeValue: draft.message.scope_value ?? "",
        startsAt: toDateTimeLocal(draft.message.starts_at),
        endsAt: toDateTimeLocal(draft.message.ends_at),
      }
    : {title: "", body: "", severity: "info", display: "banner", scope: "app", scopeValue: "", startsAt: "", endsAt: ""};

/**
 * Writing a message to the people using the app, or changing one. Who it is for is fixed once it
 * exists — retargeting a message somebody already read would make its read receipts describe a
 * different audience — so the scope is only asked for on creation.
 */
export const MessageFormModal = ({
  appId,
  draft,
  onClose,
  onSaved,
  installations,
  installationsLoading,
}: {
  appId: string;
  draft: MessageDraft | null;
  onClose: () => void;
  onSaved: (message: AppMessage) => void;
  installations: InstallationSummary[];
  installationsLoading: boolean;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {messageSeverities, messageDisplays} = useServiceVocabulary();
  const [form, setForm] = useState<Form>(() => formOf(draft ?? {mode: "create"}));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const save = useMutation(
    useCallback(
      async (current: MessageDraft, body: NewMessage) =>
        current.mode === "edit"
          ? customAppsApi.messages.update(current.message.id, {
              title: body.title,
              body: body.body,
              severity: body.severity,
              display: body.display,
              starts_at: body.starts_at,
              ends_at: body.ends_at,
            })
          : customAppsApi.messages.create(appId, body),
      [appId],
    ),
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const found: Partial<Record<keyof Form, string>> = {};
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title) found.title = t("custom_apps:validation.required");
    else if (title.length > TITLE_MAX) found.title = t("custom_apps:validation.too_long", {max: TITLE_MAX});
    if (!body) found.body = t("custom_apps:validation.required");
    else if (body.length > BODY_MAX) found.body = t("custom_apps:validation.too_long", {max: BODY_MAX});
    if (draft.mode === "create" && form.scope !== "app" && !form.scopeValue) found.scopeValue = t("custom_apps:validation.required");
    const startsAt = fromDateTimeLocal(form.startsAt);
    const endsAt = fromDateTimeLocal(form.endsAt);
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt ?? Date.now()).getTime()) {
      found.endsAt = t("custom_apps:messages.ends_before_start");
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const outcome = await save.run(draft, {
      title,
      body,
      severity: form.severity,
      display: form.display,
      scope: form.scope,
      scope_value: form.scope === "app" ? null : form.scopeValue,
      starts_at: startsAt,
      ends_at: endsAt,
    });
    if (!outcome.ok) return;
    onSaved(outcome.data);
  };

  const editing = draft?.mode === "edit";

  return (
    <Modal
      open={draft !== null}
      onClose={save.pending ? () => undefined : onClose}
      title={editing ? t("custom_apps:messages.edit_title") : t("custom_apps:messages.create_title")}
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field
          label={t("custom_apps:messages.fields.title")}
          htmlFor="message-title"
          error={errors.title}
          hint={t("custom_apps:messages.count", {count: form.title.length, max: TITLE_MAX})}
        >
          <Input
            id="message-title"
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            maxLength={TITLE_MAX}
            disabled={save.pending}
            aria-invalid={Boolean(errors.title)}
            autoComplete="off"
          />
        </Field>

        <Field
          label={t("custom_apps:messages.fields.body")}
          htmlFor="message-body"
          error={errors.body}
          hint={t("custom_apps:messages.body_hint", {count: form.body.length, max: BODY_MAX})}
        >
          <Textarea
            id="message-body"
            value={form.body}
            onChange={(event) => set("body", event.target.value)}
            maxLength={BODY_MAX}
            rows={5}
            disabled={save.pending}
            aria-invalid={Boolean(errors.body)}
            className="resize-y"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("custom_apps:messages.fields.severity")} htmlFor="message-severity">
            <Select
              id="message-severity"
              value={form.severity}
              disabled={save.pending}
              onChange={(event) => set("severity", event.target.value as MessageSeverity)}
            >
              {messageSeverities.map((severity) => (
                <option key={severity} value={severity}>
                  {t(`custom_apps:severities.${severity}`, {defaultValue: severity})}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("custom_apps:messages.fields.display")}
            htmlFor="message-display"
            hint={t(`custom_apps:messages.display_hint.${form.display}`, {defaultValue: ""})}
          >
            <Select
              id="message-display"
              value={form.display}
              disabled={save.pending}
              onChange={(event) => set("display", event.target.value as MessageDisplay)}
            >
              {messageDisplays.map((display) => (
                <option key={display} value={display}>
                  {t(`custom_apps:displays.${display}`, {defaultValue: display})}
                </option>
              ))}
            </Select>
          </Field>

          {!editing && (
            <ScopeFields
              idPrefix="message"
              scope={form.scope}
              scopeValue={form.scopeValue}
              onScope={(scope) => set("scope", scope)}
              onScopeValue={(value) => set("scopeValue", value)}
              installations={installations}
              installationsLoading={installationsLoading}
              disabled={save.pending}
              error={errors.scopeValue}
            />
          )}

          <Field label={t("custom_apps:messages.fields.starts_at")} htmlFor="message-starts" hint={t("custom_apps:messages.starts_hint")}>
            <Input
              id="message-starts"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
              disabled={save.pending}
            />
          </Field>

          <Field
            label={t("custom_apps:messages.fields.ends_at")}
            htmlFor="message-ends"
            hint={t("custom_apps:messages.ends_hint")}
            error={errors.endsAt}
          >
            <Input
              id="message-ends"
              type="datetime-local"
              value={form.endsAt}
              min={form.startsAt || undefined}
              onChange={(event) => set("endsAt", event.target.value)}
              disabled={save.pending}
              aria-invalid={Boolean(errors.endsAt)}
            />
          </Field>
        </div>

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
            {editing ? t("admin:common.save") : t("custom_apps:messages.publish")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
