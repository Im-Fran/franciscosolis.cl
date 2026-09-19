import {useMemo} from "react";
import type {ReactNode} from "react";
import {pagesApi} from "@/lib/pages/client.ts";
import {usePagesLocales} from "@/lib/pages/content.ts";
import {TranslationServiceContext} from "@/lib/prose/translation-service.ts";
import type {TranslationRequest} from "@/lib/prose/translation-service.ts";

/**
 * The same, for the standalone app pages.
 *
 * `apps/pages` is a different service from the CMS and free to publish a different set of languages
 * and a different cap, so these screens provide their own even though they live inside the CMS's
 * shell and sign in with its session.
 */
export const TranslationsProvider = ({children}: {children: ReactNode}) => {
  const {translationLocales, defaultLocale, translation} = usePagesLocales();

  const value = useMemo(() => {
    const draft = async ({text, field, targetLocale, signal}: TranslationRequest) =>
      (await pagesApi.translate({text, field, target_locale: targetLocale}, signal)).translation;

    return {
      locales: translationLocales,
      defaultLocale,
      translate: translation?.ai ? draft : null,
      maxSourceChars: translation?.max_source_chars ?? 0,
    };
  }, [translationLocales, defaultLocale, translation]);

  return <TranslationServiceContext value={value}>{children}</TranslationServiceContext>;
};
