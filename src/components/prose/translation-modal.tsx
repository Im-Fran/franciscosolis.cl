import {useEffect, useId, useState} from "react";
import {useTranslation} from "react-i18next";
/* Radix directly rather than `@/components/ui/tabs.tsx`: that one lays its triggers out as a
   220px sidebar column beside the content above `lg`, which is the console's shape and not a
   dialog's. Two language tabs above one editor is a row, at every width. */
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {Sparkle, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {clearField, controlForField, hasTranslation, writeTranslation} from "@/lib/prose/translations.ts";
import type {ProseTranslations} from "@/lib/prose/types.ts";
import {useTranslationService} from "@/lib/prose/translation-service.ts";
import {cn} from "@/lib/utils.ts";

/**
 * Where one field is translated.
 *
 * This replaces the translations *panel* that used to sit at the foot of every editor, and the
 * reason is the shape of the thing it was becoming: a second copy of the form, per language, at the
 * bottom of a screen that already scrolled. An application page has five translatable fields and
 * two languages; the panel was ten more boxes, none of them next to the text they translate.
 *
 * So the translation of a field lives on that field: a button inside the control opens this dialog,
 * which holds nothing but that one field in the other languages, with the original above it. The
 * editor never leaves the field they are working on and the page never grows.
 *
 * Two layouts, chosen by the same rule that picks the control (`controlForField`): a short field
 * gets one box per language, stacked, because seeing both at once is the whole point; a Markdown
 * body gets one *tab* per language, because two full editors in a dialog is a dialog nobody can
 * scroll.
 */

export type TranslationModalProps = {
  open: boolean;
  onClose: () => void;
  /** The field's name. Picks the control, the layout and the prompt the service is given. */
  field: string;
  /** The label the form uses for this field, so the dialog names what the editor clicked on. */
  label: string;
  /** The field's text in the default locale — what is being translated. */
  source: string;
  value: ProseTranslations;
  onChange: (value: ProseTranslations) => void;
  /** The API's own cap on this field, so the dialog refuses what the save would. */
  limit?: number;
  disabled?: boolean;
};

export const TranslationModal = ({
  open,
  onClose,
  field,
  label,
  source,
  value,
  onChange,
  limit,
  disabled,
}: TranslationModalProps) => {
  const {t} = useTranslation("prose");
  const {locales, defaultLocale, translate, maxSourceChars} = useTranslationService();
  const control = controlForField(field);
  const tabbed = control === "markdown" && locales.length > 1;
  const baseId = useId();

  const [activeLocale, setActiveLocale] = useState(locales[0] ?? "");
  const [generating, setGenerating] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * Whether this field is translated at all.
   *
   * Not stored anywhere: "not translated" and "no override written" are the same state to every
   * service here, which is what lets the switch be a switch rather than a column. It starts on, and
   * turning it off clears whatever was written — the case it exists for is a field that is the same
   * string in every language, like an application's name, where the useful answer is "leave it
   * alone" and an AI draft would be actively wrong.
   */
  const [translatable, setTranslatable] = useState(true);

  const trimmedSource = source.trim();
  const tooLong = trimmedSource.length > maxSourceChars;
  const canGenerate = translate !== null && translatable && !disabled && trimmedSource.length > 0 && !tooLong;

  /* A dialog that reopens on another field must not inherit the last one's error or its tab. */
  useEffect(() => {
    if (!open) return;
    setActiveLocale((current) => (locales.includes(current) ? current : (locales[0] ?? "")));
    setFailed(null);
    setGenerating(null);
    setTranslatable(true);
  }, [open, field, locales]);

  const localeName = (code: string) => t(`prose:locales.${code}`, {defaultValue: code.toUpperCase()});

  const setText = (locale: string, text: string) => onChange(writeTranslation(value, locale, field, text));

  const toggleTranslatable = (next: boolean) => {
    setTranslatable(next);
    if (!next) onChange(clearField(value, field));
  };

  const generate = async (locale: string) => {
    if (!translate) return;
    setGenerating(locale);
    setFailed(null);
    try {
      const draft = await translate({text: trimmedSource, field, targetLocale: locale});
      if (draft) setText(locale, draft);
      else setFailed(locale);
    } catch {
      setFailed(locale);
    } finally {
      setGenerating(null);
    }
  };

  /** One language's box, with the button that drafts it and the button that empties it. */
  const editor = (locale: string) => {
    const id = `${baseId}-${locale}`;
    const text = value[locale]?.[field] ?? "";
    const busy = generating === locale;

    return (
      <Field
        key={locale}
        label={t("prose:translations.locale_label", {locale: localeName(locale)})}
        htmlFor={id}
        error={failed === locale ? t("prose:translations.generate_failed") : null}
      >
        {control === "markdown" ? (
          <MarkdownEditor
            id={id}
            value={text}
            onChange={(next) => setText(locale, next)}
            maxLength={limit}
            rows={12}
            disabled={disabled || busy || !translatable}
          />
        ) : control === "textarea" ? (
          <Textarea
            id={id}
            value={text}
            maxLength={limit}
            rows={3}
            disabled={disabled || busy || !translatable}
            onChange={(event) => setText(locale, event.target.value)}
          />
        ) : (
          <Input
            id={id}
            value={text}
            maxLength={limit}
            disabled={disabled || busy || !translatable}
            onChange={(event) => setText(locale, event.target.value)}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canGenerate && (
            <Button type="button" variant="secondary" size="sm" onClick={() => generate(locale)} disabled={busy}>
              {busy ? <Spinner size={14}/> : <Sparkle size={15}/>}
              {busy
                ? t("prose:translations.generating")
                : text
                  ? t("prose:translations.regenerate")
                  : t("prose:translations.generate")}
            </Button>
          )}
          {text && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setText(locale, "")}
              disabled={disabled || busy}
            >
              <Trash size={14}/> {t("prose:translations.clear")}
            </Button>
          )}
        </div>
      </Field>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("prose:translations.title", {field: label})}
      className={cn(tabbed || control === "markdown" ? "max-w-3xl" : "max-w-xl")}
    >
      {locales.length === 0 ? (
        <p className="text-sm text-neutral-400">{t("prose:translations.none")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-neutral-500">
            {t("prose:translations.description", {locale: localeName(defaultLocale)})}
          </p>

          {/* The original, so the editor is translating a text rather than remembering one. */}
          <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2">
            <p className="text-[11px] tracking-wide text-neutral-500 uppercase">
              {t("prose:translations.source_label", {locale: localeName(defaultLocale)})}
            </p>
            <p className="mt-1 max-h-32 overflow-y-auto text-sm whitespace-pre-wrap text-neutral-300">
              {trimmedSource || (
                <span className="text-neutral-600">{t("prose:translations.source_empty")}</span>
              )}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={translatable}
              disabled={disabled}
              onChange={(event) => toggleTranslatable(event.target.checked)}
              className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent)]"
            />
            <span>
              {t("prose:translations.translatable")}
              <span className="block text-xs text-neutral-500">{t("prose:translations.translatable_hint")}</span>
            </span>
          </label>

          {translate !== null && tooLong && (
            <p className="text-xs text-amber-300/80">
              {t("prose:translations.too_long", {max: maxSourceChars})}
            </p>
          )}

          {tabbed ? (
            <TabsPrimitive.Root value={activeLocale} onValueChange={setActiveLocale} activationMode="automatic">
              <TabsPrimitive.List className="mb-3 flex gap-1">
                {locales.map((locale) => (
                  <TabsPrimitive.Trigger
                    key={locale}
                    value={locale}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] transition-colors",
                      "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
                      "data-[state=active]:bg-accent-900/50 data-[state=active]:text-accent-200",
                    )}
                  >
                    {localeName(locale)}
                    {/* A filled dot is the whole status a single field needs: written, or not. */}
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        hasTranslation(value, locale, field) ? "bg-accent" : "bg-neutral-700",
                      )}
                    />
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>

              {locales.map((locale) => (
                <TabsPrimitive.Content key={locale} value={locale} className="focus-visible:outline-none">
                  {editor(locale)}
                </TabsPrimitive.Content>
              ))}
            </TabsPrimitive.Root>
          ) : (
            <div className="flex flex-col gap-4">{locales.map(editor)}</div>
          )}

          {canGenerate && <p className="text-xs text-neutral-500">{t("prose:translations.generate_hint")}</p>}

          <div className="flex justify-end">
            <Button type="button" variant="primary" size="sm" onClick={onClose}>
              {t("prose:translations.done")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
