/**
 * The shape every service on this site stores a translation in.
 *
 * Three of them do — the CMS, the standalone app pages and the support help centre — and each one
 * names its own fields: an entry has a subtitle, a wiki page does not, a help article has a
 * summary. What they agree on is the envelope: a map of locale to a bag of prose overrides, with
 * the row itself holding the default locale and a missing field falling back to it.
 *
 * So the shared controls are typed on the envelope and nothing else. Each section keeps its own,
 * narrower `Translations` type for the API it talks to, and hands it over at the boundary.
 */
export type ProseTranslationFields = Record<string, string | null | undefined>;

export type ProseTranslations = Record<string, ProseTranslationFields>;

/**
 * A machine-translated draft of one field, and what was asked for.
 *
 * `translation` is nullable on purpose and is not an error: every service here answers a failed,
 * timed-out or unusable model call with a 200 and a null, because a draft is an offer rather than a
 * step in saving a record. The editor is told no draft came back and writes it themselves.
 */
export type TranslationDraftRequest = {
  text: string;
  field: string;
  /** Defaults, service-side, to the locale the record's own fields hold. */
  source_locale?: string;
  target_locale: string;
};

export type TranslationDraft = {
  translation: string | null;
  field: string;
  source_locale: string;
  target_locale: string;
  /** Which Workers AI model answered. Useful in a bug report, and nowhere else. */
  model: string;
};
