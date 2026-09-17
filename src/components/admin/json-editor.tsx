import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Broom, WarningCircle} from "@phosphor-icons/react";
import {Textarea} from "@/components/ui/input.tsx";
import {parseJsonObject} from "@/lib/cms/json.ts";
import {cn} from "@/lib/utils.ts";

export type JsonEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
};

export const JsonEditor = ({id, value, onChange, rows = 10, disabled, placeholder}: JsonEditorProps) => {
  const {t} = useTranslation();
  const result = useMemo(() => parseJsonObject(value), [value]);
  const invalid = !result.ok;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-bg">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-1.5">
          <span className="font-mono text-[11px] text-neutral-600">JSON</span>
          <button
            type="button"
            disabled={disabled || invalid || !value.trim()}
            onClick={() => {
              const parsed = parseJsonObject(value);
              if (parsed.ok && parsed.value) onChange(JSON.stringify(parsed.value, null, 2));
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            data-fs-hover
          >
            <Broom size={13}/> {t("cms:json.format")}
          </button>
        </div>
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={invalid}
          placeholder={placeholder ?? '{\n  "key": "value"\n}'}
          className={cn("resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-relaxed")}
        />
      </div>

      {invalid && (
        <p className="flex items-start gap-1.5 text-xs text-red-400">
          <WarningCircle size={14} className="mt-0.5 shrink-0"/>
          {result.error === "not-an-object"
            ? t("cms:json.not_an_object")
            : t("cms:json.invalid", {message: result.error})}
        </p>
      )}
    </div>
  );
};
