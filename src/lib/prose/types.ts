/**
 * The shape every service on this site stores a translation in.
 *
 * Three of them do — the CMS, the standalone app pages and the support help centre — and each one
 * names its own fields: an entry has a subtitle, a wiki page does not, a help article has a
 * summary. What they agree on is the envelope: a map of locale to a bag of prose overrides, with
 * the row itself holding the default locale and a missing field falling back to it.
 *
 * So the shared editor is typed on the envelope and nothing else. Each section keeps its own,
 * narrower `Translations` type for the API it talks to, and hands it to the panel at the boundary.
 */
export type ProseTranslationFields = Record<string, string | null | undefined>;

export type ProseTranslations = Record<string, ProseTranslationFields>;
