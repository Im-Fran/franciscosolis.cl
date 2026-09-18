import {useMemo} from "react";
import type {ProseTranslations} from "@/lib/prose/types.ts";
import {useSupport} from "@/lib/support/support-context.ts";
import {TranslationsPanel as ProseTranslationsPanel} from "@/components/prose/translations-panel.tsx";

/** What the article editor falls back to when the service's status call is the one thing that failed. */
const FALLBACK_DEFAULT_LOCALE = "en";

export type SupportTranslations = Record<string, Record<string, string>>;

export type TranslationsPanelProps = {
  /** The prose fields a help article has. Slug, section and ordering are structure, not prose. */
  fields: readonly string[];
  /** The source text, shown under each box so the editor can see what they are translating. */
  source: Partial<Record<string, string>>;
  value: SupportTranslations;
  onChange: (value: SupportTranslations) => void;
  /** The API's own length caps, per field. */
  limits: Partial<Record<string, number>>;
  disabled?: boolean;
};

/**
 * The help centre's translations panel: the shared editor, wired to the support service's locales.
 *
 * The support console used to mount the CMS's panel directly, which is why `/support/help/new`
 * threw `useCms must be used inside <CmsProvider>` — the component read the CMS's context for a
 * locale list, and no CMS provider exists anywhere under `/support`. The editor is shared code in
 * `@/components/prose` now and asks for the locales instead; this wrapper answers with the ones
 * `SupportProvider` already loaded from `/support/status`, and the help centre depends on nothing
 * belonging to another application.
 */
export const TranslationsPanel = ({fields, source, value, onChange, limits, disabled}: TranslationsPanelProps) => {
  const {status} = useSupport();

  const defaultLocale = status?.default_locale ?? FALLBACK_DEFAULT_LOCALE;
  const locales = useMemo(
    /* The default locale is not a translation of itself; the service rejects it as a key. */
    () => (status?.locales ?? []).filter((locale) => locale !== defaultLocale),
    [status?.locales, defaultLocale],
  );

  return (
    <ProseTranslationsPanel
      fields={fields}
      source={source}
      value={value as ProseTranslations}
      onChange={(translations) => onChange(translations as SupportTranslations)}
      limits={limits}
      locales={locales}
      defaultLocale={defaultLocale}
      ns="support_agent"
      idPrefix="article-translation"
      disabled={disabled}
    />
  );
};
