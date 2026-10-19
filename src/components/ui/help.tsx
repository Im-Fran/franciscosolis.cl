import {useState} from "react";
import type {ReactNode, SyntheticEvent} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {Info, Question} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {cn} from "@/lib/utils.ts";

/** The long explanation of one field: what it is, how to fill it in, and a valid value. */
export type FieldHelp = {what: string; how: string; example?: string};

/** The explanation of a whole form: what it is for, what can be done with it, and what saving does. */
export type FormHelp = {title?: string; what: string; canDo: string[]; onSave: string};

const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Where a help dialog lives: in `document.body`, outside whatever form, label or dialog opened it.
 *
 * Outside a `<label>` so a click inside the text never toggles the checkbox it explains, outside a
 * `<form>` so nothing in it can submit one. React still bubbles a portal's events through the
 * component tree, so they stop here: a click or a key inside the help must not reach a parent's
 * handlers — the form dialog it was opened from among them.
 */
const HelpLayer = ({children}: {children: ReactNode}) =>
  createPortal(
    <div onClick={stop} onKeyDown={stop} onPointerDown={stop}>
      {children}
    </div>,
    document.body,
  );

/**
 * Open/closed state for a help dialog that is only mounted once it is first asked for — a form with
 * thirty fields should not carry thirty closed dialogs — and stays mounted afterwards, so closing it
 * goes through `dialog.close()` and the browser hands focus back to the button that opened it.
 */
const useHelpDialog = () => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return {
    open,
    mounted,
    show: () => {
      setMounted(true);
      setOpen(true);
    },
    hide: () => setOpen(false),
  };
};

const Section = ({title, children}: {title: string; children: ReactNode}) => (
  <section className="flex flex-col gap-1.5">
    <h4 className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">{title}</h4>
    {children}
  </section>
);

/** The body of a field's help dialog: three short sections, the example only when there is one. */
export const FieldHelpContent = ({help}: {help: FieldHelp}) => {
  const {t} = useTranslation("common");
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed">
      <Section title={t("common:help.what")}>
        <p className="whitespace-pre-line text-neutral-300">{help.what}</p>
      </Section>
      <Section title={t("common:help.how")}>
        <p className="whitespace-pre-line text-neutral-300">{help.how}</p>
      </Section>
      {help.example && (
        <Section title={t("common:help.example")}>
          <p className="rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2 break-words whitespace-pre-line text-neutral-200">
            {help.example}
          </p>
        </Section>
      )}
    </div>
  );
};

/**
 * The small "i" after a field's label. It is a plain button — never a submit — and opens a dialog
 * titled with the label, which can be stacked on top of a form that is itself in a dialog: closing
 * the help returns to the form exactly as it was.
 */
export const HelpButton = ({label, help, className}: {label: string; help: FieldHelp; className?: string}) => {
  const {t} = useTranslation("common");
  const dialog = useHelpDialog();

  return (
    <>
      <button
        type="button"
        aria-label={t("common:help.aria", {label})}
        aria-haspopup="dialog"
        title={t("common:help.aria", {label})}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dialog.show();
        }}
        className={cn(
          "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors",
          "hover:bg-neutral-800 hover:text-text focus-visible:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
          className,
        )}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {dialog.mounted && (
        <HelpLayer>
          <Modal open={dialog.open} onClose={dialog.hide} title={label} className="max-w-md">
            <FieldHelpContent help={help} />
          </Modal>
        </HelpLayer>
      )}
    </>
  );
};

/** The asterisk after a required field's label, read out as a word rather than as "star". */
export const RequiredMark = () => {
  const {t} = useTranslation("common");
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-red-400">
        *
      </span>
      <span className="sr-only"> ({t("common:help.required")})</span>
    </>
  );
};

/** The one line that says what the asterisk means, near the top or the bottom of a form. */
export const RequiredLegend = ({className}: {className?: string}) => {
  const {t} = useTranslation("common");
  return (
    <p className={cn("text-[12px] text-neutral-500", className)}>
      <span aria-hidden="true" className="mr-1 text-red-400">
        *
      </span>
      {t("common:help.required_legend")}
    </p>
  );
};

export type FieldLabelProps = {
  label: string;
  /** Renders a `<label>` for this control; without it the text is a plain span (a group's title). */
  htmlFor?: string;
  required?: boolean;
  help?: FieldHelp;
  className?: string;
  /** Extra content after the label text, inside the label — a count, a unit. */
  children?: ReactNode;
};

/**
 * A field's label with its required mark and its help button, for the controls that do not sit in
 * a `Field` — a JSON editor, a checkbox card, a custom picker. The button is beside the label, never
 * inside it, so it is not read as part of the control's name.
 */
export const FieldLabel = ({label, htmlFor, required, help, className, children}: FieldLabelProps) => {
  const text = (
    <>
      {label}
      {required && <RequiredMark />}
      {children}
    </>
  );
  const textClass = "text-sm font-medium text-neutral-300";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={textClass}>
          {text}
        </label>
      ) : (
        <span className={textClass}>{text}</span>
      )}
      {help && <HelpButton label={label} help={help} />}
    </div>
  );
};

/** A fieldset's `<legend>` with the same required mark and help button as `FieldLabel`. */
export const FieldLegend = ({
  label,
  required,
  help,
  className,
  children,
}: Omit<FieldLabelProps, "htmlFor">) => (
  <legend className={cn("mb-1.5 text-sm font-medium text-neutral-300", className)}>
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>
        {label}
        {required && <RequiredMark />}
      </span>
      {help && <HelpButton label={label} help={help} />}
      {children}
    </span>
  </legend>
);

/**
 * A control that has no visible label — a filter in a list's toolbar — followed by its help button.
 * `className` sizes the pair the way the control alone used to be sized in the toolbar.
 */
export const WithHelp = ({
  label,
  help,
  className,
  children,
}: {
  label: string;
  help: FieldHelp;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn("flex items-center gap-1", className)}>
    {children}
    <HelpButton label={label} help={help} />
  </div>
);

/** The body of a form's help dialog. */
export const FormHelpContent = ({help}: {help: FormHelp}) => {
  const {t} = useTranslation("common");
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed">
      <Section title={t("common:help.form_what")}>
        <p className="whitespace-pre-line text-neutral-300">{help.what}</p>
      </Section>
      {help.canDo.length > 0 && (
        <Section title={t("common:help.form_can_do")}>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-neutral-300 marker:text-neutral-600">
            {help.canDo.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={t("common:help.form_on_save")}>
        <p className="whitespace-pre-line text-neutral-300">{help.onSave}</p>
      </Section>
    </div>
  );
};

/**
 * "How does it work?" — a form's own explanation, for a page header, a panel's action slot or a
 * dialog's header. `compact` keeps only the icon below the `sm` breakpoint, for a dialog's header
 * on a phone, where the title needs the width.
 */
export const FormHelpButton = ({help, compact, className}: {help: FormHelp; compact?: boolean; className?: string}) => {
  const {t} = useTranslation("common");
  const dialog = useHelpDialog();
  const label = t("common:help.form_button");

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        aria-label={compact ? label : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dialog.show();
        }}
        className={cn("text-neutral-300", compact && "h-8 px-2 sm:px-3", className)}
      >
        <Question size={15} aria-hidden="true" />
        <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
      </Button>
      {dialog.mounted && (
        <HelpLayer>
          <Modal open={dialog.open} onClose={dialog.hide} title={help.title ?? label} className="max-w-lg">
            <FormHelpContent help={help} />
          </Modal>
        </HelpLayer>
      )}
    </>
  );
};
