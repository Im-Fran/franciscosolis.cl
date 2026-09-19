import {useCallback, useMemo} from "react";
import {createHttpClient} from "@/lib/auth/client.ts";
import {webSession} from "@/lib/auth/session.ts";
import {useResource, type Resource} from "@/lib/auth/useResource.ts";
import {useA11y} from "@/lib/a11y";
import type {Language} from "@/lib/a11y";
import {MARKETPLACE_BASE_URL} from "@/lib/marketplace/config.ts";
import type {
  Checkout,
  DownloadRecord,
  DownloadTicket,
  MarketplaceStatus,
  MyReview,
  Pricing,
  Product,
  ProductAccess,
  ProductOverview,
  ProductRelease,
  Purchase,
  ReleaseDetail,
  ReleaseFiles,
  ReviewPayload,
  ReviewReportReason,
  ReviewsPage,
  TabDefinition,
  TranslationSupport,
  VocabularyEntry,
  WikiNode,
  WikiPage,
} from "@/lib/marketplace/types.ts";

/**
 * The public half of the marketplace API — what a product page renders itself from.
 *
 * Almost nothing here is authenticated. The service answers `/products/*` to anyone and only ever
 * with `published` rows, which is exactly the boundary a public page needs; the editorial client
 * lives in `client.ts` and is a different thing entirely, signed in under the CMS's client
 * application. Keeping them apart matters for more than tidiness: importing `client.ts` builds the
 * CMS's whole auth stack, and a visitor reading a changelog has no business holding a session to
 * do it.
 *
 * The exceptions are the store half — checkout, the caller's own review, a report — which need the
 * *site's* session (`franciscosolis-web`). The service accepts it on a second audience list with no
 * domain gate, which is the whole point: anybody may buy, and anybody who bought may review.
 *
 * The HTTP client is shared for its timeout, its `{ code, data }` unwrapping and its error
 * taxonomy — `useResource` already knows how to describe an `AuthApiError`.
 */
const http = createHttpClient(MARKETPLACE_BASE_URL, webSession);

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

export const marketplaceContent = {
  /** Every closed vocabulary this service owns: tabs, link kinds, channels, categories, locales. */
  status: (signal?: AbortSignal) => http.request<MarketplaceStatus>("/", {auth: false, signal}),

  /** Published products, without their tab bodies. */
  products: (locale?: Language, signal?: AbortSignal) =>
    http.request<Product[]>(`/products${query({locale})}`, {auth: false, signal}),

  /** One page: the banner, the tab bar, the links and the Overview and Contact documents. */
  product: (slug: string, locale?: Language, signal?: AbortSignal) =>
    http.request<Product>(`/products/${seg(slug)}${query({locale})}`, {auth: false, signal}),

  /**
   * The sidebar beside the Overview: the figures, the rating and the newest version.
   *
   * One call rather than five because it is one panel. It carries nothing per-caller, which is what
   * lets the service cache it — the price it quotes is the list price, not this visitor's access.
   */
  overview: (slug: string, locale?: Language, signal?: AbortSignal) =>
    http.request<ProductOverview>(`/products/${seg(slug)}/overview${query({locale})}`, {
      auth: false,
      signal,
    }),

  /**
   * The release feed, newest release first.
   *
   * `channel` defaults to the stable line on the service rather than here, and an unknown value is
   * *refused* rather than widened — a typo that silently meant "everything" would put nightlies in
   * front of somebody who never asked for one.
   */
  releases: (slug: string, channel?: string, locale?: Language, signal?: AbortSignal) =>
    http.request<ProductRelease[]>(`/products/${seg(slug)}/releases${query({channel, locale})}`, {
      auth: false,
      signal,
    }),

  /**
   * One release in full: its notes, what it runs on and the builds it published.
   *
   * Addressed by channel *and* version because neither identifies it alone — the same number can
   * exist on two lines. Nothing per-caller comes back; ask `access` for that half.
   */
  release: (slug: string, channel: string, version: string, locale?: Language, signal?: AbortSignal) =>
    http.request<ReleaseDetail>(
      `/products/${seg(slug)}/releases/${seg(channel)}/${seg(version)}${query({locale})}`,
      {auth: false, signal},
    ),

  /** The sidebar, as a tree, without bodies. */
  wiki: (slug: string, locale?: Language, signal?: AbortSignal) =>
    http.request<WikiNode[]>(`/products/${seg(slug)}/wiki${query({locale})}`, {auth: false, signal}),

  wikiPage: (slug: string, page: string, locale?: Language, signal?: AbortSignal) =>
    http.request<WikiPage>(`/products/${seg(slug)}/wiki/${seg(page)}${query({locale})}`, {
      auth: false,
      signal,
    }),

  /**
   * Counts one view of this product.
   *
   * A POST rather than a side effect of the read above, because the read is cached and a counter
   * that only increments on a cache miss counts caches rather than people. The service deduplicates
   * per viewer and answers `204` either way, so nothing here needs to know whether it landed.
   */
  countView: (slug: string, releaseId?: string) =>
    http.request<void>(`/products/${seg(slug)}/views`, {
      method: "POST",
      auth: "optional",
      json: releaseId ? {release_id: releaseId} : {},
    }),

  /* ── Reviews ─────────────────────────────────────────────────────────────── */

  /**
   * The Reviews tab: the summary, the histogram and one page of reviews.
   *
   * The one public read the service does not cache, and it has to stay that way: a review published
   * a second ago has to be on the page its author is sent back to.
   */
  reviews: (
    slug: string,
    params: {limit?: number; offset?: number; rating?: number} = {},
    signal?: AbortSignal,
  ) =>
    http.request<ReviewsPage>(`/products/${seg(slug)}/reviews${query({...params})}`, {
      auth: false,
      signal,
    }),

  /**
   * The caller's own review, and whether they may write one.
   *
   * `auth: "optional"` rather than required: a signed-out visitor gets `can_review: false` with
   * `not_authenticated` as the reason, which is what the form needs in order to offer a sign-in
   * instead of a 401 nobody can act on.
   */
  myReview: (slug: string, signal?: AbortSignal) =>
    http.request<MyReview>(`/products/${seg(slug)}/reviews/me`, {auth: "optional", signal}),

  /** Writes or replaces the caller's review. There is no separate create and edit. */
  saveReview: (slug: string, body: ReviewPayload) =>
    http.request<MyReview>(`/products/${seg(slug)}/reviews`, {method: "PUT", json: body}),

  /** Withdraws it. The rating recomputes without it; nothing else changes. */
  deleteReview: (slug: string) =>
    http.request<void>(`/products/${seg(slug)}/reviews`, {method: "DELETE"}),

  /** Flags somebody else's review into the moderation queue. One per person per review. */
  reportReview: (slug: string, id: string, body: {reason: ReviewReportReason | string; note?: string}) =>
    http.request<void>(`/products/${seg(slug)}/reviews/${seg(id)}/report`, {method: "POST", json: body}),

  /* ── The paid half ──────────────────────────────────────────────────────── */

  /** What the product costs. The same answer for everybody, so the service caches it. */
  pricing: (slug: string, signal?: AbortSignal) =>
    http.request<Pricing>(`/products/${seg(slug)}/pricing`, {auth: false, signal}),

  /**
   * Whether *this* visitor may download, and what to show them first.
   *
   * `auth: "optional"` rather than `false`: a signed-in visitor is recognised and gets their own
   * answer, and a signed-out one still gets the anonymous answer instead of a 401. Asking for a
   * session before telling somebody the price would put a sign-in wall in front of a free build.
   *
   * `channel` asks about one line rather than the product. That is what a `donation` product with
   * its nightlies reserved for supporters turns on: the stable answer and the nightly answer are
   * genuinely different, and a page that asked once would gate the wrong one.
   */
  access: (slug: string, channel?: string, signal?: AbortSignal) =>
    http.request<ProductAccess>(`/products/${seg(slug)}/access${query({channel})}`, {
      auth: "optional",
      signal,
    }),

  /** The builds attached to one published release, and whether taking one needs a payment first. */
  releaseFiles: (slug: string, channel: string, version: string, signal?: AbortSignal) =>
    http.request<ReleaseFiles>(
      `/products/${seg(slug)}/releases/${seg(channel)}/${seg(version)}/files`,
      {auth: false, signal},
    ),

  /**
   * Mints a download link for one build.
   *
   * The link carries who asked and whether they paid, which is why it is a POST and why nothing
   * here caches it. A non-payer's link is not valid yet — see `available_at`.
   */
  downloadTicket: (slug: string, fileId: string) =>
    http.request<DownloadTicket>(`/products/${seg(slug)}/files/${seg(fileId)}/download`, {
      method: "POST",
      auth: "optional",
    }),

  /** Opens a payment and answers where to send the browser. Requires a session; checkout is per account. */
  checkout: (slug: string, body: {amount?: number; return_path?: string} = {}) =>
    http.request<Checkout>(`/products/${seg(slug)}/checkout`, {method: "POST", json: body}),

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

export const useProduct = (slug: string): Resource<Product> => {
  const locale = useLocale();
  return useResource(
    useCallback((signal: AbortSignal) => marketplaceContent.product(slug, locale, signal), [slug, locale]),
  );
};

export const useProductOverview = (slug: string): Resource<ProductOverview> => {
  const locale = useLocale();
  return useResource(
    useCallback((signal: AbortSignal) => marketplaceContent.overview(slug, locale, signal), [slug, locale]),
  );
};

export const useProductReleases = (slug: string, channel?: string): Resource<ProductRelease[]> => {
  const locale = useLocale();
  return useResource(
    useCallback(
      (signal: AbortSignal) => marketplaceContent.releases(slug, channel, locale, signal),
      [slug, channel, locale],
    ),
  );
};

export const useProductRelease = (
  slug: string,
  channel: string,
  version: string,
): Resource<ReleaseDetail> => {
  const locale = useLocale();
  return useResource(
    useCallback(
      (signal: AbortSignal) => marketplaceContent.release(slug, channel, version, locale, signal),
      [slug, channel, version, locale],
    ),
  );
};

export const useProductWiki = (slug: string): Resource<WikiNode[]> => {
  const locale = useLocale();
  return useResource(
    useCallback((signal: AbortSignal) => marketplaceContent.wiki(slug, locale, signal), [slug, locale]),
  );
};

/**
 * One wiki page with its body. `page` is null until the sidebar has said which pages exist, which
 * is what `/wiki` with no page in the URL looks like before the first entry has been resolved.
 */
export const useProductWikiPage = (slug: string, page: string | null): Resource<WikiPage | null> => {
  const locale = useLocale();
  return useResource(
    useCallback(
      (signal: AbortSignal) => (page ? marketplaceContent.wikiPage(slug, page, locale, signal) : Promise.resolve(null)),
      [slug, page, locale],
    ),
  );
};

/**
 * The locales this service publishes in, and whether it drafts translations, for the editorial
 * translation dialog.
 *
 * Read from the service rather than mirrored from the CMS's own list: which languages the *products*
 * are published in is this service's decision, and the two are free to differ. The call is public,
 * so it needs no session, and the promise is memoised for the life of the tab — the answer is a
 * deployment constant, and every editor screen would otherwise ask again on mount.
 *
 * A failed call is not fatal: the dialog falls back to the same default the service ships with, so
 * an editor writing Spanish keeps working while the status endpoint is down. It does lose the
 * machine-translation button, which is the right way round — offering a draft the service cannot
 * produce is worse than not offering one.
 */
let statusPromise: Promise<MarketplaceStatus> | null = null;

const FALLBACK_LOCALES = ["en", "es"];
const FALLBACK_DEFAULT_LOCALE = "en";

const useStatus = () =>
  useResource(useCallback((signal: AbortSignal) => (statusPromise ??= marketplaceContent.status(signal)), []));

export const useMarketplaceLocales = (): {
  translationLocales: string[];
  defaultLocale: string;
  translation: TranslationSupport | undefined;
} => {
  const status = useStatus();

  const defaultLocale = status.data?.default_locale ?? FALLBACK_DEFAULT_LOCALE;
  const locales = status.data?.locales ?? FALLBACK_LOCALES;
  const translation = status.data?.translation;

  return useMemo(
    /* The default locale lives in the row's own columns; the service rejects it as a map key. */
    () => ({
      translationLocales: locales.filter((locale) => locale !== defaultLocale),
      defaultLocale,
      translation,
    }),
    [locales, defaultLocale, translation],
  );
};

/**
 * The tabs a page can be built from, as the service describes them.
 *
 * Read from the service for the same reason the locales are: the tab set is a registry on the
 * Worker, and a list kept here would drift the day a sixth kind of tab lands. The fallback is the
 * five this interface knows how to draw, so the editor still works while the status call is down —
 * it just stops describing them.
 */
const FALLBACK_TABS: TabDefinition[] = [
  {key: "overview", name: "Overview", description: "", source: "field"},
  {key: "releases", name: "Releases", description: "", source: "collection"},
  {key: "wiki", name: "Wiki", description: "", source: "collection"},
  {key: "reviews", name: "Reviews", description: "", source: "collection"},
  {key: "contact", name: "Contact", description: "", source: "field"},
];

export const useMarketplaceTabs = (): TabDefinition[] => useStatus().data?.tabs ?? FALLBACK_TABS;

/**
 * The categories a product can be filed under, as the service defines them.
 *
 * Same reasoning as the tabs: a closed vocabulary that lives on the Worker. An empty list is the
 * honest fallback here rather than a guessed one — a picker offering categories the service would
 * refuse is worse than a picker that is briefly empty.
 */
export const useMarketplaceCategories = (): VocabularyEntry[] => useStatus().data?.categories ?? [];

/** The kinds a compatibility entry can have. Same rule, same fallback. */
export const useCompatibilityKinds = (): VocabularyEntry[] => useStatus().data?.compatibility_kinds ?? [];

/** Flattens the sidebar tree into reading order — what "the first page" and "next page" mean. */
export const flattenWiki = (nodes: WikiNode[]): WikiNode[] =>
  nodes.flatMap((node) => [node, ...node.children]);

/** A string field the API may have sent as null, empty or missing. */
export const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};
