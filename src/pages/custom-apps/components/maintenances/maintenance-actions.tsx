import {useCallback, useEffect, useState} from "react";
import type {FormEvent, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {CheckCircle, Prohibit, XCircle} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {RequiredLegend} from "@/components/ui/help.tsx";
import type {FormHelp} from "@/components/ui/help.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {MAINTENANCE_TEXT_LIMITS} from "@/lib/custom-apps/types.ts";
import type {Maintenance} from "@/lib/custom-apps/types.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

/**
 * A confirmation for a write that is not destructive but cannot be taken back — sending the request
 * emails the client; scheduling a security patch fixes a window and tells them — with what it does in
 * words, the form's own "How does it work?", and the refusal in words when there is one.
 */
export const ConfirmActionDialog = ({
  open,
  title,
  body,
  confirmLabel,
  icon,
  help,
  pending,
  error,
  onConfirm,
  onClose,
  tone = "primary",
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  icon: ReactNode;
  help?: FormHelp;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  tone?: "primary" | "danger";
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  return (
    <Modal open={open} onClose={pending ? () => undefined : onClose} title={title} className="max-w-md" help={help}>
      <div className="flex flex-col gap-5">
        <div className="text-sm leading-relaxed text-neutral-300">{body}</div>
        {error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "secondary" : "primary"}
            onClick={onConfirm}
            disabled={pending}
            className={tone === "danger" ? "border-red-500/50 text-red-300 fs-ripple-danger" : undefined}
          >
            {pending ? <Spinner size={16} /> : icon}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export type NoteMode = "cancel" | "complete" | "fail";

const NOTE_LIMITS: Record<NoteMode, number> = {
  cancel: MAINTENANCE_TEXT_LIMITS.maxCancelReasonLength,
  complete: MAINTENANCE_TEXT_LIMITS.maxNoteLength,
  fail: MAINTENANCE_TEXT_LIMITS.maxNoteLength,
};

/**
 * Cancelling one that has not started (with an optional reason), or closing one in progress by hand
 * — as completed (an optional note) or as failed (a note saying why, required). Each says beforehand
 * what follows: the links that stop working, the hours logged, the release withdrawn.
 */
export const NoteDialog = ({
  mode,
  maintenance,
  onClose,
  onDone,
}: {
  mode: NoteMode | null;
  maintenance: Maintenance;
  onClose: () => void;
  onDone: (maintenance: Maintenance) => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = useMutation(
    useCallback(
      (value: string) => {
        if (mode === "fail") return customAppsApi.maintenances.fail(maintenance.id, value);
        if (mode === "complete") return customAppsApi.maintenances.complete(maintenance.id, value || null);
        return customAppsApi.maintenances.cancel(maintenance.id, value || null);
      },
      [mode, maintenance.id],
    ),
  );

  const {reset} = run;
  useEffect(() => {
    if (!mode) return;
    setNote("");
    setError(null);
    reset();
  }, [mode, reset]);

  if (!mode) return null;
  const required = mode === "fail";
  const limit = NOTE_LIMITS[mode];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = note.trim();
    if (required && !value) {
      setError(t("custom_apps:validation.required"));
      return;
    }
    if (value.length > limit) {
      setError(t("custom_apps:validation.too_long", {max: limit}));
      return;
    }
    const outcome = await run.run(value);
    if (outcome.ok) onDone(outcome.data);
  };

  const icon = mode === "complete" ? <CheckCircle size={16} /> : mode === "fail" ? <XCircle size={16} /> : <Prohibit size={16} />;

  return (
    <Modal
      open
      onClose={run.pending ? () => undefined : onClose}
      title={t(`custom_apps:maintenance_actions.${mode}_title`, {title: maintenance.title})}
      className="max-w-md"
      help={help.form(`maintenance_actions.form_help_${mode}`)}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <p className="text-sm leading-relaxed text-neutral-300">
          {t(`custom_apps:maintenance_actions.${mode}_body${mode === "fail" && maintenance.release ? "_release" : ""}`, {
            version: maintenance.release?.version,
          })}
        </p>
        {required && <RequiredLegend className="-mt-2" />}
        <Field
          label={t(`custom_apps:maintenance_actions.${mode}_field`)}
          htmlFor="maintenance-note"
          error={error}
          hint={t(`custom_apps:maintenance_actions.${mode}_hint`)}
          help={help.field(`maintenance_actions.help.${mode}`, {max: limit})}
          required={required}
        >
          <Textarea
            id="maintenance-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setError(null);
            }}
            maxLength={limit}
            rows={4}
            disabled={run.pending}
            aria-invalid={Boolean(error)}
            className="resize-y"
            required={required}
          />
        </Field>
        {run.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {run.status === 409 ? t("custom_apps:maintenances.errors.changed", {detail: run.error}) : t(`admin:errors.${run.error}`, {defaultValue: run.error})}
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={run.pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button
            type="submit"
            variant={mode === "complete" ? "primary" : "secondary"}
            disabled={run.pending}
            className={mode === "complete" ? undefined : "border-red-500/50 text-red-300 fs-ripple-danger"}
          >
            {run.pending ? <Spinner size={16} /> : icon}
            {t(`custom_apps:maintenance_actions.${mode}_confirm`)}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
