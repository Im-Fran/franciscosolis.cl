import * as React from "react";
import {FieldLabel} from "@/components/ui/help.tsx";
import type {FieldHelp} from "@/components/ui/help.tsx";
import {cn} from "@/lib/utils.ts";

const field =
  "w-full rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 text-sm text-text " +
  "placeholder:text-neutral-600 transition-colors hover:border-neutral-700 " +
  "focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-red-500/70";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({className, ...props}, ref) => <input ref={ref} className={cn(field, "h-11", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({className, ...props}, ref) => <textarea ref={ref} className={cn(field, "py-2.5", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({className, ...props}, ref) => (
    <select ref={ref} className={cn(field, "h-11 cursor-pointer appearance-none pr-8", className)} {...props} />
  ),
);
Select.displayName = "Select";

export type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  /** Opt-in: an info button after the label that opens this longer explanation. */
  help?: FieldHelp;
  /** Opt-in: an asterisk after the label (read out as "required"). Changes no validation. */
  required?: boolean;
};

/**
 * Label, control and message as one block, so every form in the auth interface reads the same.
 *
 * `help` and `required` are opt-in: a field that passes neither renders exactly the plain label it
 * always did.
 */
export const Field = ({label, htmlFor, hint, error, children, className, help, required}: FieldProps) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    {help || required ? (
      <FieldLabel label={label} htmlFor={htmlFor} help={help} required={required}/>
    ) : (
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-300">
        {label}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-xs text-red-400">{error}</p>
    ) : hint ? (
      <p className="text-xs text-neutral-500">{hint}</p>
    ) : null}
  </div>
);
