import {useCallback, useMemo} from "react";
import {createHttpClient} from "@/lib/auth/client.ts";
import {webSession} from "@/lib/auth/session.ts";
import {useResource, type Resource} from "@/lib/auth/useResource.ts";
import {useA11y} from "@/lib/a11y";
import type {Language} from "@/lib/a11y";
import {PAGES_BASE_URL} from "@/lib/pages/config.ts";
import type {
  Application,
  ApplicationAccess,
  ApplicationUpdate,
  Checkout,
  DownloadRecord,
  DownloadTicket,
  PagesStatus,
  Pricing,
  Purchase,
  ReleaseFiles,
  TabDefinition,
  WikiNode,
  WikiPage,
} from "@/lib/pages/types.ts";

/**
 * The public half of the Standalone App Pages API — what a product page renders itself from.
 *
 * Nothing here is authenticated. The service answers `/applications/*` to anyone and only ever with
 * `published` rows, which is exactly the boundary a public page needs; the editorial client lives in
 * `client.ts` and is a different thing entirely, signed in under the CMS's application. Keeping them
 * apart matters for more than tidiness: importing `client.ts` builds the CMS's whole auth stack, and
 * a visitor reading a changelog has no business holding a session to do it.
 *
 * The one thing shared is the HTTP client, for its timeout, its `{ code, data }` unwrapping and its
 * error taxonomy — `useResource` already knows how to describe an `AuthApiError`. It is built over
 * the site's own session, which it never reads: every call below passes `auth: false`.
 */
const http = createHttpClient(PAGES_BASE_URL, webSession);

const query = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

const seg = (value: string) => encodeURIComponent(value);

export const pagesContent = {
  /** What this service is: the tabs a page can have, the link kinds it draws, the locales it publishes. */
  status: (signal?: AbortSignal) => http.request<PagesStatus>("/", {auth: false, signal}),

  /** Published applications, without their tab bodies. */
  applications: (locale?: Language, signal?: AbortSignal) =>
    http.request<Application[]>(`/applications${query({locale})}`, {auth: false, signal}),

  /** One page: the banner, the tab bar, the links and the Overview and Contact documents. */
  application: (slug: string, locale?: Language, signal?: AbortSignal) =>
    http.request<Application>(`/applications/${seg(slug)}${query({locale})}`, {auth: false, signal}),

  updates: (slug: string, locale?: Language, signal?: AbortSignal) =>
    http.request<ApplicationUpdate[]>(`/applications/${seg(slug)}/updates${query({locale})}`, {
      auth: false,
      signal,
    }),

  /** The sidebar, as a tree, without bodies. */
  wiki: (slug: string, locale?: Language, signal?: AbortSignal) =>
    http.request<WikiNode[]>(`/applications/${seg(slug)}/wiki${query({locale})}`, {auth: false, signal}),

  wikiPage: (slug: string, page: string, locale?: Language, signal?: AbortSignal) =>
    http.request<WikiPage>(`/applications/${seg(slug)}/wiki/${seg(page)}${query({locale})}`, {
      auth: false,
      signal,
    }),

  /* ── The paid half ──────────────────────────────────────────────────────── */

  /** What the application costs. The same answer for everybody, so the service caches it. */
  pricing: (slug: string, signal?: AbortSignal) =>
    http.request<Pricing>(`/applications/${seg(slug)}/pricing`, {auth: false, signal}),

  /**
   * Whether *this* visitor may download, and what to show them first.
   *
   * `auth: "optional"` rather than `false`: a signed-in visitor is recognised and gets their own
   * answer, and a signed-out one still gets the anonymous answer instead of a 401. Asking for a
   * session before telling somebody the price would put a sign-in wall in front of a free build.
   */
  access: (slug: string, signal?: AbortSignal) =>
    http.request<ApplicationAccess>(`/applications/${seg(slug)}/access`, {auth: "optional", signal}),

  /** The builds attached to one published release, and whether taking one needs a payment first. */
  releaseFiles: (slug: string, version: string, signal?: AbortSignal) =>
    http.request<ReleaseFiles>(`/applications/${seg(slug)}/updates/${seg(version)}/files`, {
      auth: false,
      signal,
    }),

  /**
   * Mints a download link for one build.
   *
   * The link carries who asked and whether they paid, which is why it is a POST and why nothing
   * here caches it. A non-payer's link is not valid yet — see `available_at`.
   */
  downloadTicket: (slug: string, fileId: string) =>
    http.request<DownloadTicket>(`/applications/${seg(slug)}/files/${seg(fileId)}/download`, {
      method: "POST",
      auth: "optional",
    }),

  /** Opens a payment and answers where to send the browser. Requires a session; checkout is per account. */
  checkout: (slug: string, body: {amount?: number; return_path?: string} = {}) =>
    http.request<Checkout>(`/applications/${seg(slug)}/checkout`, {method: "POST", json: body}),

  /** Everything this account has paid for, newest first. */
  purchases: (signal?: AbortSignal) => http.request<Purchase[]>("/me/purchases", {signal}),

  /** One of them, by id. What the page polls after coming back from the payment provider. */
  purchase: (id: string, signal?: AbortSignal) =>
    http.request<Purchase>(`/me/purchases/${seg(id)}`, {signal}),

  /** What this account has downloaded, newest first. */
  downloads: (signal?: AbortSignal) => http.request<DownloadRecord[]>("/me/downloads", {signal}),
};

/**
 * The language every read below asks for.
 *
 * It comes from the accessibility preferences rather than from i18next directly, for the same
 * reason the CMS content hooks do: that is the value the site persists and mirrors onto
 * `<html lang>`, and reading it here keeps the copy the API serves and the copy i18next serves from
 * ever disagreeing about which language is on screen. The API answers with the locale it actually
 * used, which is not always the one asked for — an untranslated page falls back rather than 404-ing.
 */
const useLocale = (): Language => useA11y().preferences.language;

export const useApplication = (slug: string): Resource<Application> => {
  const locale = useLocale();
  return useResource(
    useCallback((signal: AbortSignal) => pagesContent.application(slug, locale, signal), [slug, locale]),
  );
};

export const useApplicationUpdates = (slug: string): Resource<ApplicationUpdate[]> => {
  const locale = useLocale();
  return useResource(
    useCallback((signal: AbortSignal) => pagesContent.updates(slug, locale, signal), [slug, locale]),
  );
};

export const useApplicationWiki = (slug: string): Resource<WikiNode[]> => {
  const locale = useLocale();
  return useResource(
    useCallback((signal: AbortSignal) => pagesContent.wiki(slug, locale, signal), [slug, locale]),
  );
};

/**
 * One wiki page with its body. `page` is null until the sidebar has said which pages exist, which
 * is what `/wiki` with no page in the URL looks like before the first entry has been resolved.
 */
export const useApplicationWikiPage = (slug: string, page: string | null): Resource<WikiPage | null> => {
  const locale = useLocale();
  return useResource(
    useCallback(
      (signal: AbortSignal) => (page ? pagesContent.wikiPage(slug, page, locale, signal) : Promise.resolve(null)),
      [slug, page, locale],
    ),
  );
};

/**
 * The locales this service publishes in, for the editorial translation panel.
 *
 * Read from the service rather than mirrored from the CMS's own list: which languages the *pages*
 * are published in is this service's decision, and the two are free to differ. The call is public,
 * so it needs no session, and the promise is memoised for the life of the tab — the answer is a
 * deployment constant, and every editor screen would otherwise ask again on mount.
 *
 * A failed call is not fatal: the panel falls back to the same default the service ships with, so
 * an editor writing Spanish keeps working while the status endpoint is down.
 */
let statusPromise: Promise<PagesStatus> | null = null;

const FALLBACK_LOCALES = ["en", "es"];
const FALLBACK_DEFAULT_LOCALE = "en";

export const usePagesLocales = (): {translationLocales: string[]; defaultLocale: string} => {
  const status = useResource(
    useCallback((signal: AbortSignal) => (statusPromise ??= pagesContent.status(signal)), []),
  );

  const defaultLocale = status.data?.default_locale ?? FALLBACK_DEFAULT_LOCALE;
  const locales = status.data?.locales ?? FALLBACK_LOCALES;

  return useMemo(
    /* The default locale lives in the row's own columns; the service rejects it as a map key. */
    () => ({translationLocales: locales.filter((locale) => locale !== defaultLocale), defaultLocale}),
    [locales, defaultLocale],
  );
};

/**
 * The tabs a page can be built from, as the service describes them.
 *
 * Read from the service for the same reason the locales are: the tab set is a registry on the
 * Worker, and a list kept here would drift the day a fifth kind of tab lands. The fallback is the
 * four this interface knows how to draw, so the editor still works while the status call is down —
 * it just stops describing them.
 */
const FALLBACK_TABS: TabDefinition[] = [
  {key: "overview", name: "Overview", description: "", source: "field"},
  {key: "updates", name: "Updates", description: "", source: "collection"},
  {key: "wiki", name: "Wiki", description: "", source: "collection"},
  {key: "contact", name: "Contact", description: "", source: "field"},
];

export const usePagesTabs = (): TabDefinition[] => {
  const status = useResource(
    useCallback((signal: AbortSignal) => (statusPromise ??= pagesContent.status(signal)), []),
  );
  return status.data?.tabs ?? FALLBACK_TABS;
};

/** Flattens the sidebar tree into reading order — what "the first page" and "next page" mean. */
export const flattenWiki = (nodes: WikiNode[]): WikiNode[] =>
  nodes.flatMap((node) => [node, ...node.children]);

/** A string field the API may have sent as null, empty or missing. */
export const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};
