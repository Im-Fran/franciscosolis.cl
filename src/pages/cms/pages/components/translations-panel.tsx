import {usePagesLocales} from "@/lib/pages/content.ts";
import type {TranslationFields, Translations} from "@/lib/pages/types.ts";
import type {ProseTranslations} from "@/lib/prose/types.ts";
import {TranslationsPanel as ProseTranslationsPanel} from "@/components/prose/translations-panel.tsx";

/**
 * The standalone app pages' translations panel: the shared editor, wired to that service's locales.
 *
 * `apps/pages` keeps a locale list of its own — it is a different service from the CMS and free to
 * publish a different set — so this wrapper reads it and hands it down. The field set differs too,
 * which the shared panel already handles: it takes the fields as a parameter and picks a control
 * from each name, so an application's five fields and a wiki page's three draw from one component.
 */

export type TranslatableField = keyof TranslationFields;

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

export const TranslationsPanel = ({fields, source, value, onChange, limits, disabled}: TranslationsPanelProps) => {
  const {translationLocales, defaultLocale} = usePagesLocales();

  return (
    <ProseTranslationsPanel
      fields={fields}
      source={source}
      value={value as ProseTranslations}
      onChange={(translations) => onChange(translations as Translations)}
      limits={limits}
      locales={translationLocales}
      defaultLocale={defaultLocale}
      ns="cms_pages"
      idPrefix="pages-translation"
      disabled={disabled}
    />
  );
};
