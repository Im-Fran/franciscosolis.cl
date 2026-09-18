import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {TranslateIcon} from "@phosphor-icons/react";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {usePagesLocales} from "@/lib/pages/content.ts";
import type {TranslationFields, Translations} from "@/lib/pages/types.ts";
import {MarkdownEditor} from "@/pages/cms/components/markdown-editor.tsx";

/**
 * Where an editor writes the other languages of an application, a release note or a wiki page.
 *
 * It is the CMS's translations panel in shape and in reasoning — only prose is translatable, a
 * blank field is not stored, and the source text sits under each box so the editor can see what
 * they are translating — but not in code, and the difference is the field set. The CMS translates
 * one kind of row and can name its four fields in a type; this service translates three kinds with
 * three different field lists, so the panel takes them as a parameter and decides how to draw each
 * one from its name.
 *
 * A field left blank is not stored: the service drops empty overrides and falls back to the source
 * text for that field alone. So a partly-filled locale is a valid, useful state rather than a
 * half-saved one, and the badge on each tab says how much of it is done.
 */

export type TranslatableField = keyof TranslationFields;

/** Which control a field gets. Derived from the name, so a new field needs no wiring here. */
const controlOf = (field: TranslatableField): "markdown" | "textarea" | "input" =>
  field.endsWith("body") ? "markdown" : field === "summary" ? "textarea" : "input";

export type TranslationsPanelProps = {
  /** The fields this kind of row has. An application's are not a wiki page's. */
  fields: readonly TranslatableField[];
  /** The source text, shown under each box so the editor can see what they are translating. */
  source: Partial<Record<TranslatableField, string>>;
  value: Translations;
  onChange: (value: Translations) => void;
  /** The API's own length caps, per field. */
  limits: Partial<Record<TranslatableField, number>>;
  disabled?: boolean;
};

const fieldId = (locale: string, field: TranslatableField) => `pages-translation-${locale}-${field}`;

/** How many of this row's fields the locale has text for — what the tab badge counts. */
const filledCount = (translation: TranslationFields | undefined, fields: readonly TranslatableField[]) =>
  fields.filter((field) => (translation?.[field] ?? "").trim().length > 0).length;

export const TranslationsPanel = ({fields, source, value, onChange, limits, disabled}: TranslationsPanelProps) => {
  const {t} = useTranslation(["cms_pages", "cms"]);
  const {translationLocales, defaultLocale} = usePagesLocales();
  const [activeLocale, setActiveLocale] = useState<string | null>(null);

  const locale =
    activeLocale && translationLocales.includes(activeLocale) ? activeLocale : (translationLocales[0] ?? null);
  const translation = useMemo(() => (locale ? (value[locale] ?? {}) : {}), [value, locale]);

  /**
   * Writes one field of one locale, dropping the locale once nothing is left in it.
   *
   * Keeping an empty object around would be harmless — the service prunes it — but it would leave
   * the tab badge reading "0/5" for a language the editor has just finished clearing, which looks
   * like work in progress rather than like "there is no Spanish here".
   */
  const setField = (field: TranslatableField, textValue: string) => {
    if (!locale) return;

    const next: TranslationFields = {...translation, [field]: textValue};
    const kept = Object.fromEntries(
      Object.entries(next).filter(([, entry]) => (entry ?? "").trim().length > 0),
    ) as TranslationFields;

    const updated = {...value};
    if (Object.keys(kept).length > 0) updated[locale] = kept;
    else delete updated[locale];

    onChange(updated);
  };

  const clearLocale = () => {
    if (!locale) return;
    const updated = {...value};
    delete updated[locale];
    onChange(updated);
  };

  const localeName = (code: string) => t(`cms:locales.${code}`, {defaultValue: code.toUpperCase()});

  return (
    <Panel
      title={t("cms_pages:translations.title")}
      description={t("cms_pages:translations.description", {locale: localeName(defaultLocale)})}
      action={<TranslateIcon size={18} className="text-neutral-500"/>}
    >
      {!locale ? (
        <p className="text-sm text-neutral-400">{t("cms_pages:translations.none")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {translationLocales.map((code) => {
              const filled = filledCount(value[code], fields);
              return (
                <Button
                  key={code}
                  type="button"
                  variant={code === locale ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setActiveLocale(code)}
                  data-fs-hover
                >
                  {localeName(code)}
                  <Badge variant={filled > 0 ? "accent" : "neutral"}>{`${filled}/${fields.length}`}</Badge>
                </Button>
              );
            })}
            {filledCount(translation, fields) > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearLocale}
                disabled={disabled}
                className="ml-auto"
                data-fs-hover
              >
                {t("cms_pages:translations.clear", {locale: localeName(locale)})}
              </Button>
            )}
          </div>

          {fields.map((field) => {
            const id = fieldId(locale, field);
            const original = (source[field] ?? "").trim();
            const hint = original
              ? t("cms_pages:translations.source", {
                  text: original.length > 160 ? `${original.slice(0, 160)}…` : original,
                })
              : t("cms_pages:translations.source_empty");
            const control = controlOf(field);

            return (
              <Field key={field} label={t(`cms_pages:fields.${field}`)} htmlFor={id} hint={hint}>
                {control === "markdown" ? (
                  <MarkdownEditor
                    id={id}
                    value={translation[field] ?? ""}
                    onChange={(next) => setField(field, next)}
                    maxLength={limits[field]}
                    rows={14}
                    disabled={disabled}
                  />
                ) : control === "textarea" ? (
                  <Textarea
                    id={id}
                    value={translation[field] ?? ""}
                    maxLength={limits[field]}
                    rows={3}
                    disabled={disabled}
                    onChange={(event) => setField(field, event.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    value={translation[field] ?? ""}
                    maxLength={limits[field]}
                    disabled={disabled}
                    onChange={(event) => setField(field, event.target.value)}
                  />
                )}
              </Field>
            );
          })}
        </div>
      )}
    </Panel>
  );
};
