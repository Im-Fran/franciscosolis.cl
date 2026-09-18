import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight, LifebuoyIcon} from "@phosphor-icons/react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportContent} from "@/lib/support/content.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {HelpSearchBox} from "@/pages/help/components/help-search-box.tsx";

/**
 * The front door: a search box, the sections, and the articles worth reading first.
 *
 * Everything here is a public read with a `public, max-age=60` on it, so this page costs the service
 * almost nothing however many people land on it — which matters, because it is the page a "contact
 * support" link points at.
 */
export const HelpHome = () => {
  const {t, i18n} = useTranslation("support");
  const locale = i18n.resolvedLanguage ?? "en";

  const categories = useResource(
    useCallback((signal: AbortSignal) => supportContent.categories(locale, signal), [locale]),
  );
  const featured = useResource(
    useCallback(
      (signal: AbortSignal) => supportContent.articles({featured: true, locale, limit: 6}, signal),
      [locale],
    ),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10 text-center">
        <LifebuoyIcon size={40} className="mx-auto mb-4 text-accent-300" aria-hidden />
        <h1 className="font-display text-3xl text-text sm:text-4xl">{t("help.title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-400">{t("help.lead")}</p>
      </header>

      <div className="mb-12">
        <HelpSearchBox autoFocus />
      </div>

      {featured.loading || categories.loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : null}

      {(featured.data?.length ?? 0) > 0 ? (
        <section className="mb-12">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-neutral-400 uppercase">{t("help.featured")}</h2>
          <ul className="flex flex-col gap-2">
            {featured.data?.map((article) => (
              <li key={article.slug}>
                <Link
                  to={helpRoute.article(article.slug)}
                  className="group flex items-start gap-3 rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-accent-500/40"
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-text">{article.title}</span>
                    {article.summary ? (
                      <span className="mt-1 block text-sm text-neutral-400">{article.summary}</span>
                    ) : null}
                  </span>
                  <ArrowRight
                    size={16}
                    className="mt-0.5 shrink-0 text-neutral-600 transition-colors group-hover:text-accent-300"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(categories.data?.length ?? 0) > 0 ? (
        <section className="mb-12">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-neutral-400 uppercase">{t("help.categories")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {categories.data?.map((category) => (
              <li key={category.slug}>
                <Link
                  to={helpRoute.category(category.slug)}
                  className="block h-full rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-accent-500/40"
                >
                  <span className="block text-sm font-medium text-text">{category.name}</span>
                  {category.description ? (
                    <span className="mt-1 block text-sm text-neutral-400">{category.description}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-6 text-center">
        <h2 className="text-sm font-medium text-text">{t("help.still_stuck")}</h2>
        <Link
          to={helpRoute.newTicket}
          className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
        >
          {t("help.open_ticket")}
          <ArrowRight size={16} aria-hidden />
        </Link>
      </section>
    </div>
  );
};
