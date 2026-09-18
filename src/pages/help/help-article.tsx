import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {ArrowLeft, ThumbsDown, ThumbsUp} from "@phosphor-icons/react";
import {Spinner} from "@/components/ui/spinner.tsx";
import {NotFound} from "@/pages/not-found/not-found.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {PROSE_CLASS, renderMarkdown} from "@/lib/prose/markdown.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {supportContent} from "@/lib/support/content.ts";

/**
 * One help article.
 *
 * The body is Markdown from the service, rendered through the same sanitizing renderer the CMS
 * preview uses. Markdown passes raw HTML through by design, and an article is written by a person
 * with an editor account rather than by the public — but "written by staff" is not the same as
 * "safe to inject", and the renderer is already here.
 */
export const HelpArticle = () => {
  const {t, i18n} = useTranslation("support");
  const {slug = ""} = useParams();
  const locale = i18n.resolvedLanguage ?? "en";
  const [rated, setRated] = useState(false);

  const article = useResource(
    useCallback((signal: AbortSignal) => supportContent.article(slug, locale, signal), [slug, locale]),
  );

  const html = useMemo(() => (article.data?.body ? renderMarkdown(article.data.body) : ""), [article.data?.body]);

  const rate = (helpful: boolean) => {
    setRated(true);
    /* Fire and forget: a failed vote is not worth an error message on an article somebody is reading. */
    void supportContent.rateArticle(slug, helpful, locale).catch(() => undefined);
  };

  if (article.status === 404) return <NotFound />;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link to={helpRoute.home} className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-text">
        <ArrowLeft size={14} aria-hidden />
        {t("help.back_to_help")}
      </Link>

      {article.loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : null}

      {article.data ? (
        <>
          <h1 className="font-display text-2xl text-text sm:text-3xl">{article.data.title}</h1>
          {article.data.summary ? <p className="mt-3 text-sm text-neutral-400">{article.data.summary}</p> : null}

          {/* eslint-disable-next-line react/no-danger -- sanitized by renderMarkdown. */}
          <div className={`mt-8 ${PROSE_CLASS}`} dangerouslySetInnerHTML={{__html: html}} />

          <section className="mt-12 rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-5">
            {rated ? (
              <p className="text-sm text-neutral-300">{t("help.thanks")}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-neutral-300">{t("help.was_helpful")}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => rate(true)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-accent-500/40 hover:text-text"
                  >
                    <ThumbsUp size={15} aria-hidden />
                    {t("help.helpful_yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => rate(false)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-accent-500/40 hover:text-text"
                  >
                    <ThumbsDown size={15} aria-hidden />
                    {t("help.helpful_no")}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="mt-4 text-center text-sm text-neutral-500">
            {t("help.still_stuck")}{" "}
            <Link to={helpRoute.newTicket} className="text-accent-300 underline underline-offset-4">
              {t("help.open_ticket")}
            </Link>
          </section>
        </>
      ) : null}
    </article>
  );
};
