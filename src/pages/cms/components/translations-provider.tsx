import {useMemo} from "react";
import type {ReactNode} from "react";
import {useCms} from "@/lib/cms/cms-context.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {TranslationServiceContext} from "@/lib/prose/translation-service.ts";
import type {TranslationRequest} from "@/lib/prose/translation-service.ts";

/**
 * Tells the CMS's translation controls which service they are talking to.
 *
 * The controls are shared with two other sections and know nothing about this one — which languages
 * a service publishes, and whether it drafts them, is that service's decision. This is where the
 * CMS answers, reading what `CmsProvider` already loaded from `/cms/status`, and it is the only
 * place a CMS editor needs to know the difference.
 *
 * It wraps the *form*, not the shell, because the standalone app pages are edited inside the same
 * shell against a different service: two providers under one layout, each over its own screens.
 */
export const TranslationsProvider = ({children}: {children: ReactNode}) => {
  const {translationLocales, defaultLocale, translation} = useCms();

  const value = useMemo(() => {
    const draft = async ({text, field, targetLocale, signal}: TranslationRequest) =>
      (await cmsApi.translate({text, field, target_locale: targetLocale}, signal)).translation;

    return {
      locales: translationLocales,
      defaultLocale,
      /* No button at all when the service does not offer drafts, or when its status call failed. */
      translate: translation?.ai ? draft : null,
      maxSourceChars: translation?.max_source_chars ?? 0,
    };
  }, [translationLocales, defaultLocale, translation]);

  return <TranslationServiceContext value={value}>{children}</TranslationServiceContext>;
};
