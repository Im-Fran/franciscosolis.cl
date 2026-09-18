import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {Alert} from "@/components/ui/alert.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {HelpSnippet} from "@/components/support/help-snippet.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {supportContent} from "@/lib/support/content.ts";
import {HelpSearchBox} from "@/pages/help/components/help-search-box.tsx";

export const HelpSearch = () => {
  const {t, i18n} = useTranslation("support");
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const locale = i18n.resolvedLanguage ?? "en";

  const results = useResource(
    useCallback(
      (signal: AbortSignal) =>
        query.trim().length === 0
          ? Promise.resolve({hits: [], fallbackLocale: false})
          : supportContent.search(query, locale, signal),
      [query, locale],
    ),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="mb-8">
        <HelpSearchBox initial={query} />
      </div>

      <h1 className="mb-6 text-lg text-text">{t("help.results_for", {query})}</h1>

      {results.loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : null}

      {/* A Spanish search that only matched English articles is a fact about the search, so it is
          said once at the top rather than repeated on every result. */}
      {results.data?.fallbackLocale ? (
        <Alert tone="info" className="mb-6">
          {t("help.fallback_locale")}
        </Alert>
      ) : null}

      {!results.loading && (results.data?.hits.length ?? 0) === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-6 text-center">
          <p className="text-sm text-neutral-400">{t("help.no_results")}</p>
          <Link
            to={helpRoute.newTicket}
            className="mt-4 inline-block rounded-[var(--radius-sm)] bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
          >
            {t("help.open_ticket")}
          </Link>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {results.data?.hits.map((hit) => (
          <li key={`${hit.slug}-${hit.locale}`}>
            <Link
              to={helpRoute.article(hit.slug)}
              className="block rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-accent-500/40"
            >
              {/* Both of these carry `<mark>` from SQLite's snippet(), sanitized to that one tag. */}
              <HelpSnippet html={hit.title} className="block text-sm font-medium text-text" />
              <HelpSnippet html={hit.snippet} className="mt-1 block text-sm text-neutral-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
