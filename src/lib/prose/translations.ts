import type {ProseTranslationFields, ProseTranslations} from "@/lib/prose/types.ts";

/**
 * The rules every translation control on this site shares.
 *
 * They live beside the types rather than inside the component because three services use them and
 * two of them are read outside React: which control a field gets, how many locales a field is
 * translated into, and what writing one field of one locale does to the map.
 */

export type TranslationControl = "markdown" | "textarea" | "input";

/**
 * Which control a field gets, derived from its name so a service that adds a field needs no wiring
 * here: anything ending in `body` is long-form Markdown, a summary or a description is a few lines,
 * the rest are single-line headings.
 *
 * The same rule decides how the translation modal is laid out — a Markdown field gets one tab per
 * language, because two full editors stacked in a dialog is a dialog nobody can scroll — and the
 * API's own `@franciscosolis/translate` picks its prompt with an identical test. Three copies of one
 * rule, deliberately: the alternative is a field-by-field registry in four places.
 */
export const controlForField = (field: string): TranslationControl =>
  field.endsWith("body") ? "markdown" : field === "summary" || field === "description" ? "textarea" : "input";

/** True when this locale has something written for this field. */
export const hasTranslation = (translations: ProseTranslations, locale: string, field: string) =>
  (translations[locale]?.[field] ?? "").trim().length > 0;

/** How many locales this one field is translated into — what the badge on the button counts. */
export const translatedLocales = (translations: ProseTranslations, field: string, locales: readonly string[]) =>
  locales.filter((locale) => hasTranslation(translations, locale, field));

/**
 * Writes one field of one locale.
 *
 * An empty value is a deletion rather than an empty override, and a locale left with nothing in it
 * disappears entirely. Both services prune exactly the same way on save, so doing it here keeps the
 * button's badge honest — without it, clearing the last field of a language would leave a `{}`
 * behind and the field would keep counting as translated until the next reload.
 */
export const writeTranslation = (
  translations: ProseTranslations,
  locale: string,
  field: string,
  text: string,
): ProseTranslations => {
  const next: ProseTranslationFields = {...(translations[locale] ?? {}), [field]: text};
  const kept = Object.fromEntries(
    Object.entries(next).filter(([, value]) => (value ?? "").trim().length > 0),
  ) as ProseTranslationFields;

  const updated = {...translations};
  if (Object.keys(kept).length > 0) updated[locale] = kept;
  else delete updated[locale];

  return updated;
};

/** Drops one field from every locale. What the "this field is not translated" switch does. */
export const clearField = (translations: ProseTranslations, field: string): ProseTranslations => {
  let updated = translations;
  for (const locale of Object.keys(translations)) {
    updated = writeTranslation(updated, locale, field, "");
  }
  return updated;
};
