import {useState} from "react";
import type {KeyboardEvent} from "react";
import {useTranslation} from "react-i18next";
import {X} from "@phosphor-icons/react";
import {Input} from "@/components/ui/input.tsx";

export type TagInputProps = {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** The API caps a single tag at 60 characters. */
  maxTagLength?: number;
};

/**
 * Tags as chips. Enter and comma commit the draft, Backspace on an empty field takes the last one
 * back, and a blur commits too — a value left sitting in the box on submit is the classic way to
 * lose a tag without noticing.
 */
export const TagInput = ({id, value, onChange, placeholder, disabled, maxTagLength = 60}: TagInputProps) => {
  const {t} = useTranslation();
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const entries = raw
      .split(",")
      .map((entry) => entry.trim().slice(0, maxTagLength))
      .filter(Boolean);
    if (entries.length === 0) return;
    onChange([...new Set([...value, ...entries])]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 py-1 pr-1 pl-2.5 text-xs text-neutral-300"
            >
              {tag}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((entry) => entry !== tag))}
                aria-label={t("cms:tags.remove", {tag})}
                className="cursor-pointer rounded-[var(--radius-sm)] p-0.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-text disabled:cursor-not-allowed"
                data-fs-hover
              >
                <X size={12}/>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        id={id}
        value={draft}
        disabled={disabled}
        maxLength={maxTagLength}
        placeholder={placeholder ?? t("cms:tags.placeholder")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />
    </div>
  );
};
