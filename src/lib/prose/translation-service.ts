import {createContext, useContext} from "react";

/**
 * What a section tells its translation controls about the service behind them.
 *
 * Three services on this site store translations — the CMS, the standalone app pages and the
 * support help centre — and each publishes its own languages, holds its own caps and is called with
 * its own client. A control that reached into one section's context was a component of that section
 * (the mistake that made the help-centre editor throw inside `<CmsProvider>`'s hook), so the shared
 * controls read *this* context and each section provides it once, at the top of its editor.
 */
export type TranslationRequest = {
  /** The source text, in the record's default locale. */
  text: string;
  /** The field's name — `title`, `summary`, `overview_body`, … */
  field: string;
  /** A locale the record can carry an override for. Never the default one. */
  targetLocale: string;
  signal?: AbortSignal;
};

export type TranslationServiceValue = {
  /** Every locale this service publishes except the default one, which lives in the record itself. */
  locales: string[];
  /** The locale the record's own fields hold. */
  defaultLocale: string;
  /**
   * Asks the service for a machine-translated draft, or `null` when it does not offer them.
   *
   * It resolves to `null` rather than rejecting when no usable draft came back: the API answers a
   * failed model call with `translation: null` and a 200, because a draft is an offer and not a
   * step in saving a record. Only a transport or authorisation failure rejects.
   */
  translate: ((request: TranslationRequest) => Promise<string | null>) | null;
  /** Longest source text the service will translate. A field over it offers no draft. */
  maxSourceChars: number;
};

export const TranslationServiceContext = createContext<TranslationServiceValue | null>(null);

/**
 * The service a translation control is talking to.
 *
 * Falls back to "one language, no machine translation" rather than throwing when no provider is
 * mounted. A missing provider must cost the translate button, never the form it is embedded in —
 * that is the same failure mode the old panel had and the reason this context exists at all.
 */
export const useTranslationService = (): TranslationServiceValue =>
  useContext(TranslationServiceContext) ?? {locales: [], defaultLocale: "en", translate: null, maxSourceChars: 0};
