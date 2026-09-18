import {cn} from "@/lib/utils.ts";

export type SegmentedOption<T extends string> = {value: T; label: string};

export type SegmentedProps<T extends string> = {
  /** Shared radio name — what makes the arrow keys move between the options and not out of them. */
  name: string;
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A short, mutually exclusive choice: the delivery-log filter, the compose mode, the layout.
 *
 * Real radio inputs hidden under the labels rather than a row of buttons — the keyboard and screen
 * reader behaviour of a radio group is exactly what this control means, and none of it has to be
 * re-implemented to get it.
 */
export const Segmented = <T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: SegmentedProps<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn(
      "inline-flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-neutral-800 bg-bg p-1",
      className,
    )}
  >
    {options.map((option) => (
      <label
        key={option.value}
        className={cn(
          "cursor-pointer rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] transition-colors",
          "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-0",
          option.value === value ? "bg-neutral-800 text-text" : "text-neutral-400 hover:text-text",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={option.value === value}
          disabled={disabled}
          onChange={() => onChange(option.value)}
          className="sr-only"
        />
        {option.label}
      </label>
    ))}
  </div>
);
