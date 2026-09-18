import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {TranslateIcon} from "@phosphor-icons/react";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import type {ProseTranslationFields, ProseTranslations} from "@/lib/prose/types.ts";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";

/**
 * Where an editor writes the other languages of a record — a CMS entry, a legal document, an
 * application page, a help article.
 *
 * The panel is deliberately *not* a second copy of the form. Only prose is translatable — slugs,
 * dates, links, tags and the `data` blob are the same fact in every language — so what it shows is
 * a handful of text fields per locale, each with the source text underneath it. Seeing what is
 * being translated beside the box it goes in is the difference between translating a record and
 * guessing which of two similar summaries this field was.
 *
 * A field left blank is not stored: every service here drops empty overrides and falls back to the
 * source text for that field alone. So a partly-filled locale is a valid, useful state rather than
 * a half-saved one, and the badge on each tab says how much of it is done.
 *
 * It takes its locales as a parameter rather than reading a context, and that is the whole reason
 * this file is shared instead of copied. Three services publish translations and each keeps its own
 * locale list on its own status endpoint; a panel that reached into one section's provider was a
 * component of that section, and mounting it anywhere else — as the support console's article
 * editor did — threw the moment the hook ran.
 */

type TranslationControl = "markdown" | "textarea" | "input";

/**
 * Which control a field gets. Derived from its name, so a service that adds a field needs no wiring
 * here: anything ending in `body` is long-form markdown, a summary is a few lines, the rest are
 * single-line headings.
 */
const controlForField = (field: string): TranslationControl =>
  field.endsWith("body") ? "markdown" : field === "summary" ? "textarea" : "input";

export type TranslationsPanelProps = {
  /** The fields this kind of record has. A legal page has no subtitle; a wiki page has no summary. */
  fields: readonly string[];
  /** The source text, shown under each box so the editor can see what they are translating. */
  source: Partial<Record<string, string>>;
  value: ProseTranslations;
  onChange: (value: ProseTranslations) => void;
  /** The API's own length caps, per field. */
  limits: Partial<Record<string, number>>;
  /** Every locale this service publishes except the default one, which lives in the record itself. */
  locales: readonly string[];
  /** The locale the record's own columns hold, named in the panel's description. */
  defaultLocale: string;
  /** i18n namespace holding this screen's `editor.*` copy — `cms_content`, `support_agent`, … */
  ns: string;
  /** Keeps field ids unique when two panels share a screen. */
  idPrefix?: string;
  disabled?: boolean;
};

/** How many of a record's fields this locale has text for — what the tab badge counts. */
const filledCount = (translation: ProseTranslationFields | undefined, fields: readonly string[]) =>
  fields.filter((field) => (translation?.[field] ?? "").trim().length > 0).length;

export const TranslationsPanel = ({
  fields,
  source,
  value,
  onChange,
  limits,
  locales,
  defaultLocale,
  ns,
  idPrefix = "translation",
  disabled,
}: TranslationsPanelProps) => {
  const {t} = useTranslation([ns, "prose"]);
  const [activeLocale, setActiveLocale] = useState<string | null>(null);

  const locale = activeLocale && locales.includes(activeLocale) ? activeLocale : (locales[0] ?? null);
  const translation = useMemo(() => (locale ? (value[locale] ?? {}) : {}), [value, locale]);

  /**
   * Writes one field of one locale, dropping the locale once nothing is left in it.
   *
   * Keeping an empty object around would be harmless — every service prunes it — but it would make
   * the tab badge read "0/4" for a language the editor has just finished clearing, which reads as
   * work in progress rather than as "there is no Spanish here".
   */
  const setField = (field: string, text: string) => {
    if (!locale) return;

    const next: ProseTranslationFields = {...translation, [field]: text};
    const kept = Object.fromEntries(
      Object.entries(next).filter(([, entry]) => (entry ?? "").trim().length > 0),
    ) as ProseTranslationFields;

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

  const localeName = (code: string) => t(`prose:locales.${code}`, {defaultValue: code.toUpperCase()});

  /* The editors label their fields differently — `editor.fields.title` on legal pages,
     `editor.title` on content entries — so the panel reads whichever of the two exists. */
  const fieldLabel = (field: string) =>
    t(`${ns}:editor.fields.${field}`, {defaultValue: t(`${ns}:editor.${field}`, {defaultValue: field})});

  return (
    <Panel
      title={t(`${ns}:editor.translations_title`)}
      description={t(`${ns}:editor.translations_description`, {locale: localeName(defaultLocale)})}
      action={<TranslateIcon size={18} className="text-neutral-500"/>}
    >
      {locales.length === 0 || !locale ? (
        <p className="text-sm text-neutral-400">{t(`${ns}:editor.translations_none`)}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {locales.map((code) => {
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
                {t(`${ns}:editor.translations_clear`, {locale: localeName(locale)})}
              </Button>
            )}
          </div>

          {fields.map((field) => {
            const id = `${idPrefix}-${locale}-${field}`;
            const original = (source[field] ?? "").trim();
            const hint = original
              ? t(`${ns}:editor.translations_source`, {
                  text: original.length > 160 ? `${original.slice(0, 160)}…` : original,
                })
              : t(`${ns}:editor.translations_source_empty`);
            const control = controlForField(field);

            return (
              <Field key={field} label={fieldLabel(field)} htmlFor={id} hint={hint}>
                {control === "markdown" ? (
                  <MarkdownEditor
                    id={id}
                    value={translation[field] ?? ""}
                    onChange={(text) => setField(field, text)}
                    maxLength={limits[field]}
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
