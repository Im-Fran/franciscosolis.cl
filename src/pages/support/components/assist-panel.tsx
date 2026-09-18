import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Sparkle} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {supportApi} from "@/lib/support/client.ts";
import {helpRoute} from "@/lib/support/config.ts";
import type {AssistAnswer, SupportLocale} from "@/lib/support/types.ts";

/**
 * "Search with AI": a draft answer built from the published help centre.
 *
 * Two things about this panel are deliberate and should stay that way.
 *
 * It **puts the draft in the composer** and stops. There is no send button here, and there must not
 * be one: the model answers only from retrieved articles and its citations are checked against what
 * was actually retrieved, but neither of those makes it right about a particular customer's
 * situation. A person reads it, edits it, and sends it.
 *
 * It **shows what it read**. An answer whose sources are visible can be checked in ten seconds; one
 * without them has to be taken on faith, which is exactly the habit not to build.
 */
export const AssistPanel = ({
  ticketId,
  locale,
  onInsert,
}: {
  ticketId: string;
  locale: SupportLocale;
  onInsert: (text: string) => void;
}) => {
  const {t} = useTranslation("support_agent");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistAnswer | null>(null);

  const ask = useMutation(
    useCallback((query: string) => supportApi.assist(query, locale, ticketId), [locale, ticketId]),
  );

  const run = async () => {
    const query = question.trim();
    if (query.length < 3) return;
    const outcome = await ask.run(query);
    setAnswer(outcome.ok ? outcome.data : null);
  };

  return (
    <section className="rounded-[var(--radius-md)] border border-accent-500/25 bg-accent-500/5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-accent-200">
        <Sparkle size={16} aria-hidden />
        {t("assist.title")}
      </h3>
      <p className="mt-1 text-xs text-neutral-400">{t("assist.hint")}</p>

      <div className="mt-3 flex gap-2">
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("assist.placeholder")}
          className="flex-1"
        />
        <Button onClick={run} disabled={ask.pending || question.trim().length < 3} data-fs-hover>
          {ask.pending ? <Spinner size={16} /> : null}
          {ask.pending ? t("assist.running") : t("assist.run")}
        </Button>
      </div>

      {ask.error ? (
        <Alert tone="error" className="mt-3">
          {ask.error}
        </Alert>
      ) : null}

      {answer ? (
        <div className="mt-4">
          {answer.insufficient_context || !answer.answer ? (
            <Alert tone="info">{t("assist.insufficient")}</Alert>
          ) : (
            <>
              <p className="whitespace-pre-wrap rounded-[var(--radius-sm)] border border-neutral-800 bg-neutral-900/60 p-3 text-sm leading-relaxed text-neutral-200">
                {answer.answer}
              </p>

              {answer.sources.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs text-neutral-500">
                    {t("assist.sources")}
                    {answer.confidence ? ` · ${t("assist.confidence")}: ${answer.confidence}` : null}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {answer.sources.map((source) => (
                      <li key={source.slug}>
                        <Link
                          to={helpRoute.article(source.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent-300 underline underline-offset-4"
                          data-fs-hover
                        >
                          {source.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => onInsert(answer.answer ?? "")}
                data-fs-hover
              >
                {t("assist.insert")}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};
