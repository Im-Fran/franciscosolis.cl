import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {FloppyDisk} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {Flag, FlagValue, InstallationSummary, TargetScope} from "@/lib/custom-apps/types.ts";
import {flagKindOf} from "@/pages/custom-apps/components/config/flag-kind.ts";
import type {FlagKind} from "@/pages/custom-apps/components/config/flag-kind.ts";
import {ScopeFields} from "@/pages/custom-apps/components/scope-fields.tsx";

/** The service's own pattern for a key: lowercase, digits, `_`, `.` and `-`, up to 64 characters. */
const FLAG_KEY = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const DESCRIPTION_MAX = 500;

export type FlagDraft =
  | {mode: "create"; key?: string}
  | {mode: "edit"; flag: Flag};

type Form = {
  key: string;
  kind: FlagKind;
  /** Kept as text for every kind, so a number field can be emptied mid-edit. */
  value: string;
  description: string;
  scope: TargetScope;
  scopeValue: string;
};

const formOf = (draft: FlagDraft): Form =>
  draft.mode === "edit"
    ? {
        key: draft.flag.key,
        kind: flagKindOf(draft.flag.value),
        value: String(draft.flag.value),
        description: draft.flag.description ?? "",
        scope: draft.flag.scope,
        scopeValue: draft.flag.scope_value ?? "",
      }
    : {
        key: draft.key ?? "",
        kind: "boolean",
        value: "true",
        description: "",
        /* "Add an override" on an existing key: an override is never the app scope, which is taken. */
        scope: draft.key ? "channel" : "app",
        scopeValue: "",
      };

const valueOf = (form: Form): FlagValue | null => {
  if (form.kind === "boolean") return form.value === "true";
  if (form.kind === "number") {
    const number = Number(form.value);
    return form.value.trim() !== "" && Number.isFinite(number) ? number : null;
  }
  return form.value;
};

/** Creating a flag, adding an override of one, or changing one's value and description. */
export const FlagFormModal = ({
  appId,
  draft,
  onClose,
  onSaved,
  installations,
  installationsLoading,
}: {
  appId: string;
  draft: FlagDraft | null;
  onClose: () => void;
  onSaved: (flag: Flag) => void;
  installations: InstallationSummary[];
  installationsLoading: boolean;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [form, setForm] = useState<Form>(() => formOf(draft ?? {mode: "create"}));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const save = useMutation(
    useCallback(
      async (current: FlagDraft, body: Form, value: FlagValue) =>
        current.mode === "edit"
          ? customAppsApi.flags.update(current.flag.id, {value, description: orNull(body.description)})
          : customAppsApi.flags.create(appId, {
              key: body.key.trim(),
              value,
              description: orNull(body.description),
              scope: body.scope,
              scope_value: body.scope === "app" ? null : body.scopeValue,
            }),
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
    if (draft.mode === "create" && !FLAG_KEY.test(form.key.trim())) found.key = t("custom_apps:flags.invalid_key");
    const value = valueOf(form);
    if (value === null) found.value = t("custom_apps:flags.invalid_number");
    if (draft.mode === "create" && form.scope !== "app" && !form.scopeValue) found.scopeValue = t("custom_apps:validation.required");
    setErrors(found);
    if (Object.keys(found).length > 0 || value === null) return;

    const outcome = await save.run(draft, form, value);
    if (!outcome.ok) return;
    onSaved(outcome.data);
  };

  const editing = draft?.mode === "edit";

  return (
    <Modal
      open={draft !== null}
      onClose={save.pending ? () => undefined : onClose}
      title={
        editing
          ? t("custom_apps:flags.edit_title", {key: form.key})
          : draft?.mode === "create" && draft.key
            ? t("custom_apps:flags.override_title", {key: draft.key})
            : t("custom_apps:flags.create_title")
      }
      className="max-w-lg"
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t("custom_apps:flags.key")} htmlFor="flag-key" hint={t("custom_apps:flags.key_hint")} error={errors.key}>
          <Input
            id="flag-key"
            value={form.key}
            onChange={(event) => set("key", event.target.value.toLowerCase())}
            disabled={editing || Boolean(draft?.mode === "create" && draft.key) || save.pending}
            maxLength={64}
            placeholder="checkout.new_flow"
            aria-invalid={Boolean(errors.key)}
            autoComplete="off"
            className="font-mono text-[13px]"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Field label={t("custom_apps:flags.kind")} htmlFor="flag-kind">
            <Select
              id="flag-kind"
              value={form.kind}
              disabled={save.pending}
              onChange={(event) => {
                const kind = event.target.value as FlagKind;
                set("kind", kind);
                set("value", kind === "boolean" ? "true" : kind === "number" ? "0" : "");
              }}
            >
              {(["boolean", "string", "number"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(`custom_apps:flags.kinds.${kind}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("custom_apps:flags.value")} htmlFor="flag-value" error={errors.value}>
            {form.kind === "boolean" ? (
              <Select id="flag-value" value={form.value} disabled={save.pending} onChange={(event) => set("value", event.target.value)}>
                <option value="true">true</option>
                <option value="false">false</option>
              </Select>
            ) : (
              <Input
                id="flag-value"
                type={form.kind === "number" ? "number" : "text"}
                inputMode={form.kind === "number" ? "decimal" : undefined}
                step="any"
                value={form.value}
                onChange={(event) => set("value", event.target.value)}
                disabled={save.pending}
                aria-invalid={Boolean(errors.value)}
                autoComplete="off"
                className="font-mono text-[13px]"
              />
            )}
          </Field>
        </div>

        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ScopeFields
              idPrefix="flag"
              scope={form.scope}
              scopeValue={form.scopeValue}
              onScope={(scope) => set("scope", scope)}
              onScopeValue={(value) => set("scopeValue", value)}
              installations={installations}
              installationsLoading={installationsLoading}
              disabled={save.pending}
              error={errors.scopeValue}
            />
          </div>
        )}

        <Field label={t("custom_apps:flags.description")} htmlFor="flag-description" hint={t("custom_apps:flags.description_hint")}>
          <Input
            id="flag-description"
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={DESCRIPTION_MAX}
            disabled={save.pending}
            autoComplete="off"
          />
        </Field>

        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {save.status === 409
              ? t("custom_apps:flags.conflict")
              : t(`admin:errors.${save.error}`, {defaultValue: save.error})}
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
