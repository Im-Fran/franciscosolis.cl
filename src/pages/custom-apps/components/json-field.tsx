import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Broom, WarningCircle} from "@phosphor-icons/react";
import {Textarea} from "@/components/ui/input.tsx";
import {parseJsonObject} from "@/lib/cms/json.ts";
import {cn} from "@/lib/utils.ts";

/**
 * A textarea for a JSON *object* — a configuration document, a schema, a command's payload — with
 * the parse error under it as it is typed. The service is the authority on what the object may
 * contain; this only makes sure what goes up is an object at all, and says so before a round trip.
 */
export const JsonField = ({
  id,
  value,
  onChange,
  rows = 10,
  disabled,
  placeholder,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  /** Marks the field invalid for a reason found elsewhere — the service's issues. */
  invalid?: boolean;
  describedBy?: string;
}) => {
  const {t} = useTranslation("custom_apps");
  const result = useMemo(() => parseJsonObject(value), [value]);
  const broken = !result.ok;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-bg">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
          <span className="font-mono text-[11px] text-neutral-600">JSON</span>
          <button
            type="button"
            disabled={disabled || broken || !value.trim()}
            onClick={() => {
              if (result.ok && result.value) onChange(JSON.stringify(result.value, null, 2));
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Broom size={13} /> {t("json.format")}
          </button>
        </div>
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={broken || invalid}
          aria-describedby={describedBy}
          placeholder={placeholder ?? '{\n  "key": "value"\n}'}
          className="resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-relaxed"
        />
      </div>

      {broken && (
        <p className={cn("flex items-start gap-1.5 text-xs text-red-400")}>
          <WarningCircle size={14} className="mt-0.5 shrink-0" />
          {result.error === "not-an-object" ? t("json.not_an_object") : t("json.invalid", {message: result.error})}
        </p>
      )}
    </div>
  );
};
