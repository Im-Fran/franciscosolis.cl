import {useCms} from "@/lib/cms/cms-context.ts";
import type {TranslationFields, Translations} from "@/lib/cms/types.ts";
import type {ProseTranslations} from "@/lib/prose/types.ts";
import {TranslationsPanel as ProseTranslationsPanel} from "@/components/prose/translations-panel.tsx";

/**
 * The CMS's translations panel: the shared editor, wired to the CMS's own locale list.
 *
 * The panel itself lives in `@/components/prose` and knows nothing about this section — which
 * languages a service publishes is that service's decision, so it takes them as a parameter. This
 * wrapper is where the CMS answers that question, reading the list `CmsProvider` loaded from
 * `/cms/status`, and is the only place a CMS screen needs to know the difference.
 */

export type TranslatableField = keyof TranslationFields;

export type TranslationsPanelProps = {
  /** Which fields this record has. A legal page has no subtitle. */
  fields: readonly TranslatableField[];
  /** The source text, shown under each box so the editor can see what they are translating. */
  source: Partial<Record<TranslatableField, string>>;
  value: Translations;
  onChange: (value: Translations) => void;
  /** The API's own length caps, per field. */
  limits: Partial<Record<TranslatableField, number>>;
  /** i18n namespace holding this screen's `editor.*` copy — `cms_content` or `cms_legal`. */
  ns: string;
  disabled?: boolean;
};

export const TranslationsPanel = ({fields, source, value, onChange, limits, ns, disabled}: TranslationsPanelProps) => {
  const {translationLocales, defaultLocale} = useCms();

  return (
    <ProseTranslationsPanel
      fields={fields}
      source={source}
      value={value as ProseTranslations}
      onChange={(translations) => onChange(translations as Translations)}
      limits={limits}
      locales={translationLocales}
      defaultLocale={defaultLocale}
      ns={ns}
      disabled={disabled}
    />
  );
};
