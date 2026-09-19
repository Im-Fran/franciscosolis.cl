import {cloneElement, isValidElement, useState} from "react";
import type {ReactElement, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {TranslateIcon} from "@phosphor-icons/react";
import {Field} from "@/components/ui/input.tsx";
import {TranslationModal} from "@/components/prose/translation-modal.tsx";
import {controlForField, translatedLocales} from "@/lib/prose/translations.ts";
import type {ProseTranslations} from "@/lib/prose/types.ts";
import {useTranslationService} from "@/lib/prose/translation-service.ts";
import {cn} from "@/lib/utils.ts";

/**
 * A form field that carries its own translations.
 *
 * The control is whatever the editor already rendered; what this adds is a translate icon *inside*
 * it, on the right, and the dialog behind it. That placement is the whole design: the translations
 * of a title belong on the title, not in a second form at the bottom of the page. An editor with
 * five translatable fields used to grow ten extra boxes below the fold; now it grows five icons.
 *
 * The icon says how much is done without being opened — filled once any language is written, with
 * the count beside it when the service publishes more than two. That is deliberately the only
 * status here: whether a *specific* language is written is a question the dialog answers, and
 * putting it on the form would be a per-language badge on every field.
 *
 * Nothing about it is a second source of truth. The dialog writes into the same `translations` map
 * the form already submits, through the same `onChange`, so saving is the ordinary PATCH it always
 * was and there is no "save the translation" step to get out of step with the record.
 */

export type TranslatableFieldProps = {
  label: string;
  /** The id of the control, so the label points at it exactly as `<Field>` always did. */
  htmlFor: string;
  hint?: string;
  error?: string | null;
  /** The field's name in the translation map — `title`, `summary`, `overview_body`, … */
  field: string;
  /** The field's text in the default locale, shown in the dialog as what is being translated. */
  source: string;
  value: ProseTranslations;
  onChange: (value: ProseTranslations) => void;
  /** The API's own cap on this field. */
  limit?: number;
  disabled?: boolean;
  className?: string;
  /**
   * The control.
   *
   * A plain element for an input or a textarea — the icon is positioned inside its box and the
   * element is given room for it. A Markdown editor has a toolbar of its own and no corner to spare,
   * so it takes the function form and renders the icon in that toolbar instead.
   */
  children: ReactNode | ((action: ReactNode) => ReactNode);
};

export const TranslatableField = ({
  label,
  htmlFor,
  hint,
  error,
  field,
  source,
  value,
  onChange,
  limit,
  disabled,
  className,
  children,
}: TranslatableFieldProps) => {
  const {t} = useTranslation("prose");
  const {locales} = useTranslationService();
  const [open, setOpen] = useState(false);

  const done = translatedLocales(value, field, locales).length;
  const control = controlForField(field);

  const action = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={disabled}
      title={t("prose:translations.open_label", {field: label})}
      aria-label={t("prose:translations.open_label", {field: label})}
      aria-haspopup="dialog"
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] p-1.5 text-xs transition-colors",
        "hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40",
        done > 0 ? "text-accent-200" : "text-neutral-500 hover:text-neutral-300",
      )}
    >
      <TranslateIcon size={16}/>
      {/* Two languages is one translation, and "1/1" is noise. Three is a count worth printing. */}
      {locales.length > 1 && <span className="tabular-nums">{`${done}/${locales.length}`}</span>}
    </button>
  );

  /* Nothing to translate into: the icon would open a dialog with no boxes in it. */
  if (locales.length === 0) {
    return (
      <Field label={label} htmlFor={htmlFor} hint={hint} error={error} className={className}>
        {typeof children === "function" ? children(null) : children}
      </Field>
    );
  }

  return (
    <Field label={label} htmlFor={htmlFor} hint={hint} error={error} className={className}>
      {typeof children === "function" ? (
        children(action)
      ) : (
        <div className="relative">
          {/* The control keeps its own styling and is only given room for the icon. */}
          {isValidElement<{className?: string}>(children)
            ? cloneElement(children as ReactElement<{className?: string}>, {
                className: cn(children.props.className, control === "textarea" ? "pr-11" : "pr-10"),
              })
            : children}
          <div className={cn("absolute right-1.5", control === "textarea" ? "top-1.5" : "top-1/2 -translate-y-1/2")}>
            {action}
          </div>
        </div>
      )}

      <TranslationModal
        open={open}
        onClose={() => setOpen(false)}
        field={field}
        label={label}
        source={source}
        value={value}
        onChange={onChange}
        limit={limit}
        disabled={disabled}
      />
    </Field>
  );
};
