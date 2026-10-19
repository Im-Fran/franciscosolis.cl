import type {ReactNode} from "react";
import {HelpButton} from "@/components/ui/help.tsx";
import type {FieldHelp} from "@/components/ui/help.tsx";
import {cn} from "@/lib/utils.ts";

/**
 * One yes/no switch with its help button, in the two shapes the panel draws them.
 *
 * - `card`: a bordered box with the label and a line of explanation under it (renews itself, carry
 *   hours over, allow screenshots). `tone` paints the box while it is checked.
 * - `plain`: the checkbox and its label on one line (the rule is active, the primary contact).
 *
 * The help button sits beside the label, never inside it: a button inside a `<label>` would be read
 * as part of the checkbox's name. The hint is a second `<label>` for the same box, so clicking it
 * still toggles it, as it did when the whole card was one label.
 */
export const CheckboxField = ({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
  help,
  variant = "card",
  tone = "neutral",
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  help?: FieldHelp;
  variant?: "card" | "plain";
  /** What the card looks like while checked: unchanged, or amber for a switch with consequences. */
  tone?: "neutral" | "warning";
  className?: string;
}) => {
  const input = (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className={cn("size-4 shrink-0 accent-[var(--color-accent)]", variant === "card" && "mt-0.5")}
    />
  );

  if (variant === "plain") {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-2.5 text-sm text-neutral-300", disabled && "cursor-not-allowed")}>
          {input}
          {label}
        </label>
        {help && <HelpButton label={label} help={help} />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors",
        tone === "warning" && checked ? "border-amber-500/50 bg-amber-500/5" : "border-neutral-800 hover:border-neutral-700",
        disabled && "opacity-60",
        className,
      )}
    >
      {input}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <label htmlFor={id} className={cn("cursor-pointer text-sm text-text", disabled && "cursor-not-allowed")}>
            {label}
          </label>
          {help && <HelpButton label={label} help={help} />}
        </div>
        {hint && (
          <label
            htmlFor={id}
            className={cn("mt-0.5 block cursor-pointer text-[12px] leading-relaxed text-neutral-500", disabled && "cursor-not-allowed")}
          >
            {hint}
          </label>
        )}
      </div>
    </div>
  );
};
