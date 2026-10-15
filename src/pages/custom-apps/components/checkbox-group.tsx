import {cn} from "@/lib/utils.ts";

export type CheckboxOption = {value: string; label: string; hint?: string};

/**
 * A set of independent yes/no choices whose value is the list of the checked ones — the roles a
 * contact holds at a company, the modules an app reports. Kept in the order the options are given,
 * not in the order they were ticked, so saving twice never reads as a change.
 */
export const CheckboxGroup = ({
  idPrefix,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  idPrefix: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
}) => (
  <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
    {options.map((option) => {
      const id = `${idPrefix}-${option.value}`;
      const checked = value.includes(option.value);
      return (
        <label
          key={option.value}
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
            checked ? "border-accent-700 bg-accent-900/30" : "border-neutral-800 hover:border-neutral-700",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                options
                  .map((entry) => entry.value)
                  .filter((entry) => (entry === option.value ? event.target.checked : value.includes(entry))),
              )
            }
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="min-w-0">
            <span className="block text-sm text-text">{option.label}</span>
            {option.hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">{option.hint}</span>}
          </span>
        </label>
      );
    })}
  </div>
);
