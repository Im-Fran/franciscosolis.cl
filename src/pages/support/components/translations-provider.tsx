import {useMemo} from "react";
import type {ReactNode} from "react";
import {supportApi} from "@/lib/support/client.ts";
import {useSupport} from "@/lib/support/support-context.ts";
import {TranslationServiceContext} from "@/lib/prose/translation-service.ts";
import type {TranslationRequest} from "@/lib/prose/translation-service.ts";

/** What the help centre falls back to when the service's status call is the one thing that failed. */
const FALLBACK_DEFAULT_LOCALE = "en";

/**
 * The same, for the help centre.
 *
 * The console used to mount the CMS's translations panel directly, which is why `/support/help/new`
 * threw `useCms must be used inside <CmsProvider>`: the component read another application's
 * context for a locale list. The controls read a context of their own now, and this is where the
 * support console fills it in from what `SupportProvider` already loaded.
 */
export const TranslationsProvider = ({children}: {children: ReactNode}) => {
  const {status} = useSupport();

  const defaultLocale = status?.default_locale ?? FALLBACK_DEFAULT_LOCALE;
  const translation = status?.translation;
  const locales = status?.locales;

  const value = useMemo(() => {
    const draft = async ({text, field, targetLocale, signal}: TranslationRequest) =>
      (await supportApi.translate({text, field, target_locale: targetLocale}, signal)).translation;

    return {
      /* The default locale is not a translation of itself; the service rejects it as a key. */
      locales: (locales ?? []).filter((locale) => locale !== defaultLocale),
      defaultLocale,
      translate: translation?.ai ? draft : null,
      maxSourceChars: translation?.max_source_chars ?? 0,
    };
  }, [locales, defaultLocale, translation]);

  return <TranslationServiceContext value={value}>{children}</TranslationServiceContext>;
};
