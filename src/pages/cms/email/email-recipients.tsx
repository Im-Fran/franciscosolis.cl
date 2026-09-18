import {useState} from "react";
import type {KeyboardEvent} from "react";
import {useTranslation} from "react-i18next";
import {X} from "@phosphor-icons/react";
import {Input} from "@/components/ui/input.tsx";
import {SEND_LIMITS, isEmailAddress, splitAddresses} from "@/pages/cms/email/email-shared.ts";

export type EmailRecipientsProps = {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /** The form's own complaint about the list as a whole, shown under the field. */
  error?: string | null;
};

/**
 * The `to` list as chips.
 *
 * `TagInput` has the same shape but takes whatever is typed into it, and a mistyped address here is
 * a message that quietly never arrives. So this variant checks every committed value, refuses
 * duplicates, stops at the twenty recipients the API allows — and says which of the three happened
 * instead of dropping the entry on the floor. Whatever it refuses stays in the box, ready to be
 * fixed rather than retyped.
 */
export const EmailRecipients = ({id, value, onChange, disabled, error}: EmailRecipientsProps) => {
  const {t} = useTranslation(["cms_emails", "cms"]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const commit = (raw: string) => {
    const entries = splitAddresses(raw);
    if (entries.length === 0) return;

    const accepted: string[] = [];
    const rejected: string[] = [];
    let problem: string | null = null;

    for (const entry of entries) {
      /* Addresses are compared and stored lowercased; the mailbox part is case-sensitive in theory
         and never in practice, and "Fran@…" listed twice would be one message too many. */
      const address = entry.toLowerCase();

      if (value.length + accepted.length >= SEND_LIMITS.recipients) {
        problem = t("cms_emails:recipients.too_many", {max: SEND_LIMITS.recipients});
        rejected.push(entry);
        continue;
      }
      if (!isEmailAddress(address)) {
        problem = t("cms:validation.invalid_email");
        rejected.push(entry);
        continue;
      }
      if (value.includes(address) || accepted.includes(address)) {
        problem = t("cms_emails:recipients.duplicate", {address});
        continue;
      }
      accepted.push(address);
    }

    if (accepted.length > 0) onChange([...value, ...accepted]);
    setDraft(rejected.join(", "));
    setNotice(problem);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
      setNotice(null);
    }
  };

  const remove = (address: string) => {
    onChange(value.filter((entry) => entry !== address));
    setNotice(null);
  };

  const message = error ?? notice;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((address) => (
            <li
              key={address}
              className="inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 py-1 pr-1 pl-2.5 text-xs text-neutral-300"
            >
              <span className="truncate">{address}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(address)}
                aria-label={t("cms_emails:recipients.remove", {address})}
                className="cursor-pointer rounded-[var(--radius-sm)] p-0.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-text disabled:cursor-not-allowed"
              >
                <X size={12}/>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="off"
        value={draft}
        disabled={disabled || value.length >= SEND_LIMITS.recipients}
        aria-invalid={message ? true : undefined}
        aria-describedby={`${id}-note`}
        placeholder={
          value.length >= SEND_LIMITS.recipients
            ? t("cms_emails:recipients.full")
            : t("cms_emails:recipients.placeholder")
        }
        onChange={(event) => {
          setDraft(event.target.value);
          setNotice(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />

      <p id={`${id}-note`} className="flex flex-wrap justify-between gap-2 text-xs">
        <span className={message ? "text-red-400" : "text-neutral-500"}>
          {message ?? t("cms_emails:recipients.hint")}
        </span>
        <span className="text-neutral-600">
          {t("cms_emails:recipients.count", {used: value.length, max: SEND_LIMITS.recipients})}
        </span>
      </p>
    </div>
  );
};
