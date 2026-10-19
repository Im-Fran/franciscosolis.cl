import {useEffect, useState} from "react";
import type {FormEvent, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {ArrowsClockwise, Warning} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {addDays, addMonths, formatDay} from "@/lib/custom-apps/format.ts";
import type {Contract} from "@/lib/custom-apps/types.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import type {FieldHelp, FormHelp} from "@/components/ui/help.tsx";
import {CheckboxField} from "@/pages/custom-apps/components/checkbox-field.tsx";
import {RequiredLegend} from "@/components/ui/help.tsx";

const TEXT_MAX = 500;

const Failure = ({error}: {error: string | null}) => {
  const {t} = useTranslation("admin");
  if (!error) return null;
  return (
    <Alert tone="error" title={t("common.failed")}>
      {t(`errors.${error}`, {defaultValue: error})}
    </Alert>
  );
};

/**
 * A confirmation that takes one optional line of text — why a contract was cancelled, the invoice a
 * cycle was billed on. The text goes into the record or the audit log, where the next reader looks.
 */
export const TextDialog = ({
  open,
  title,
  body,
  label,
  hint,
  confirmLabel,
  multiline,
  danger,
  pending,
  error,
  onConfirm,
  onClose,
  help,
  formHelp,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  label: string;
  hint?: string;
  /** The text field's own help. */
  help?: FieldHelp;
  /** What this particular action does, behind the dialog's "How does it work?". */
  formHelp?: FormHelp;
  confirmLabel: string;
  multiline?: boolean;
  danger?: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: (text: string | null) => void;
  onClose: () => void;
}) => {
  const {t} = useTranslation("admin");
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onConfirm(text.trim() || null);
  };

  return (
    <Modal open={open} onClose={pending ? () => undefined : onClose} title={title} className="max-w-md" help={formHelp}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="text-sm leading-relaxed text-neutral-300">{body}</div>
        <Field label={label} htmlFor="contract-dialog-text" hint={hint} help={help}>
          {multiline ? (
            <Textarea
              id="contract-dialog-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={TEXT_MAX}
              rows={3}
              disabled={pending}
              className="resize-y"
            />
          ) : (
            <Input
              id="contract-dialog-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={TEXT_MAX}
              disabled={pending}
              autoComplete="off"
            />
          )}
        </Field>
        <Failure error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant={danger ? "secondary" : "primary"}
            disabled={pending}
            className={danger ? "border-red-500/50 text-red-300 fs-ripple-danger" : undefined}
          >
            {pending ? <Spinner size={16} /> : danger ? <Warning size={16} /> : null}
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * Renewing a contract: a new last day, later than the current one and no earlier than today, or no
 * end at all. The presets add the contract's own renewal length, or a year, to its current end.
 *
 * Renewing a contract that lapsed brings back the apps the lapse put in grace or suspended, which the
 * dialog says before it is clicked.
 */
export const RenewDialog = ({
  open,
  contract,
  today,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  contract: Contract;
  today: string;
  pending: boolean;
  error: string | null;
  onConfirm: (endsOn: string | null) => void;
  onClose: () => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const language = i18n.language;
  const base = contract.ends_on && contract.ends_on > today ? contract.ends_on : today;
  const [endsOn, setEndsOn] = useState("");
  const [openEnded, setOpenEnded] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEndsOn(addMonths(base, contract.renewal_months || 12));
    setOpenEnded(false);
    setInvalid(null);
  }, [open, base, contract.renewal_months]);

  /* The earliest valid day: after the current end, and today at least. */
  const min = contract.ends_on ? (addDays(contract.ends_on, 1) > today ? addDays(contract.ends_on, 1) : today) : today;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!openEnded) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
        setInvalid(t("custom_apps:validation.required"));
        return;
      }
      if (endsOn < min) {
        setInvalid(t("custom_apps:contract.renew_too_early", {date: formatDay(min, language)}));
        return;
      }
    }
    onConfirm(openEnded ? null : endsOn);
  };

  const presets = [...new Set([contract.renewal_months || 12, 12])].map((months) => ({months, day: addMonths(base, months)}));

  return (
    <Modal open={open} onClose={pending ? () => undefined : onClose} title={t("custom_apps:contract.renew_title")}
      className="max-w-md"
      help={help.form("contract.renew_form_help")}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <p className="text-sm leading-relaxed text-neutral-300">
          {contract.ends_on
            ? t("custom_apps:contract.renew_body", {date: formatDay(contract.ends_on, language)})
            : t("custom_apps:contract.renew_body_open")}
        </p>
        {!openEnded && <RequiredLegend className="-mt-2" />}
        {(contract.status === "grace" || contract.status === "ended" || contract.lapsed_at) && (
          <Alert tone="info" title={t("custom_apps:contract.renew_lapsed_title")}>
            {t("custom_apps:contract.renew_lapsed_body")}
          </Alert>
        )}
        <Field
          label={t("custom_apps:contract.renew_until")}
          htmlFor="contract-renew-until"
          error={invalid}
          hint={t("custom_apps:contract.renew_until_hint")}
          help={help.field("contract.help.renew_until")}
          required={!openEnded}
        >
          <Input
            id="contract-renew-until"
            type="date"
            value={endsOn}
            min={min}
            onChange={(event) => {
              setEndsOn(event.target.value);
              setInvalid(null);
            }}
            disabled={pending || openEnded}
            aria-invalid={Boolean(invalid)}
          />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.months}
              type="button"
              onClick={() => {
                setEndsOn(preset.day);
                setOpenEnded(false);
                setInvalid(null);
              }}
              disabled={pending}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-neutral-800 px-2 py-0.5 text-[12px] text-neutral-400 transition-colors hover:text-text"
            >
              {t("custom_apps:contract.renew_preset", {count: preset.months})}
            </button>
          ))}
        </div>
        <CheckboxField
          variant="plain"
          id="contract-renew-open-ended"
          label={t("custom_apps:contract.renew_open_ended")}
          checked={openEnded}
          onChange={setOpenEnded}
          disabled={pending}
          help={help.field("contract.help.renew_open_ended")}
        />
        <Failure error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner size={16} /> : <ArrowsClockwise size={16} />}
            {t("custom_apps:contract.renew")}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
