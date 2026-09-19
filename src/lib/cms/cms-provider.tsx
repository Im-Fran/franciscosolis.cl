import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {describeError} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {CmsContext} from "@/lib/cms/cms-context.ts";
import type {CmsCollection, CmsEditor, CmsStatus} from "@/lib/cms/types.ts";

/** What the editors fall back to when the service's status call is the one thing that failed. */
const FALLBACK_DEFAULT_LOCALE = "en";

/**
 * Loads the three things every CMS screen needs — who is signed in *here*, which collections the
 * service manages, and which languages it publishes them in — once, above the whole signed-in
 * subtree.
 *
 * Doing it in one place is what lets the layout answer the "is this account admitted at all"
 * question a single time: `/admin/me` replies 403 for an account with no role in the CMS, and the
 * shell renders the no-access screen instead of every panel failing on its own.
 */
export const CmsProvider = ({children}: {children: ReactNode}) => {
  const [editor, setEditor] = useState<CmsEditor | null>(null);
  const [collections, setCollections] = useState<CmsCollection[]>([]);
  const [status, setStatus] = useState<CmsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    /* The collections are public, so a 403 on `/admin/me` still leaves the shell something to show. */
    Promise.allSettled([
      cmsApi.me(controller.signal),
      cmsApi.collections(controller.signal),
      cmsApi.status(controller.signal),
    ])
      .then(([me, list, service]) => {
        if (controller.signal.aborted) return;

        if (me.status === "fulfilled") {
          setEditor(me.value);
          setError(null);
          setForbidden(false);
        } else {
          const described = describeError(me.reason);
          setEditor(null);
          setForbidden(described.status === 403);
          setError(described.status === 403 ? null : described.message);
        }

        if (list.status === "fulfilled") setCollections(list.value);
        /* Not fatal: a failed status call costs the translation editors their locale list, and
           they fall back to the default rather than the whole shell refusing to render. */
        if (service.status === "fulfilled") setStatus(service.value);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  const defaultLocale = status?.default_locale ?? FALLBACK_DEFAULT_LOCALE;
  const locales = status?.locales;

  const value = useMemo(
    () => ({
      editor,
      collections,
      /* The default locale is not a translation of itself; the service rejects it as a key. */
      translationLocales: (locales ?? []).filter((locale) => locale !== defaultLocale),
      defaultLocale,
      translation: status?.translation,
      loading,
      error,
      forbidden,
      reload,
    }),
    [editor, collections, locales, defaultLocale, status?.translation, loading, error, forbidden, reload],
  );

  return <CmsContext value={value}>{children}</CmsContext>;
};
