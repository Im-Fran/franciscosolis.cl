import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {ArrowLeft} from "@phosphor-icons/react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {supportContent} from "@/lib/support/content.ts";

export const HelpCategory = () => {
  const {t, i18n} = useTranslation("support");
  const {slug = ""} = useParams();
  const locale = i18n.resolvedLanguage ?? "en";

  const category = useResource(
    useCallback((signal: AbortSignal) => supportContent.category(slug, locale, signal), [slug, locale]),
  );

  if (category.status === 404) return <NotFound />;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link to={helpRoute.home} className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-text">
        <ArrowLeft size={14} aria-hidden />
        {t("help.back_to_help")}
      </Link>

      {category.loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : null}

      {category.data ? (
        <>
          <h1 className="font-display text-2xl text-text">{category.data.name}</h1>
          {category.data.description ? (
            <p className="mt-2 text-sm text-neutral-400">{category.data.description}</p>
          ) : null}

          <ul className="mt-8 flex flex-col gap-2">
            {(category.data.articles ?? []).map((article) => (
              <li key={article.slug}>
                <Link
                  to={helpRoute.article(article.slug)}
                  className="block rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-accent-500/40"
                >
                  <span className="block text-sm font-medium text-text">{article.title}</span>
                  {article.summary ? <span className="mt-1 block text-sm text-neutral-400">{article.summary}</span> : null}
                </Link>
              </li>
            ))}
          </ul>

          {(category.data.articles?.length ?? 0) === 0 ? (
            <p className="mt-8 text-sm text-neutral-500">{t("help.empty")}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
