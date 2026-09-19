import {createContext, useContext} from "react";
import type {CmsCollection, CmsEditor, TranslationSupport} from "@/lib/cms/types.ts";

export type CmsContextValue = {
  /** The account behind the current token, as the CMS itself sees it. */
  editor: CmsEditor | null;
  /** The collections the service manages — what the navigation is built from. */
  collections: CmsCollection[];
  /**
   * The languages an entry can be translated into: every locale the service publishes except the
   * default one, which lives in the entry's own fields rather than in its translation map.
   *
   * Read from the service rather than mirrored from the site's own language list: which languages
   * the *content* is published in is the CMS's decision, and the two are free to differ.
   */
  translationLocales: string[];
  /** The locale an entry's own columns hold. */
  defaultLocale: string;
  /**
   * Whether the service drafts translations with Workers AI, and how long a field it will accept.
   *
   * Absent when the status call failed, which costs the editor the "draft with AI" button and
   * nothing else — offering a draft the service cannot produce is worse than not offering one.
   */
  translation: TranslationSupport | undefined;
  loading: boolean;
  error: string | null;
  /** Signed in, but holding no role in this application: the API answered 403 to `/admin/me`. */
  forbidden: boolean;
  reload: () => void;
};

export const CmsContext = createContext<CmsContextValue | null>(null);

export const useCms = () => {
  const value = useContext(CmsContext);
  if (!value) throw new Error("useCms must be used inside <CmsProvider>");
  return value;
};

/** The collection the interface should open first, and the fallback when a slug is unknown. */
export const firstCollection = (collections: CmsCollection[]) => collections[0]?.slug ?? null;
