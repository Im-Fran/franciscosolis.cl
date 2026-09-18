import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowLeft, GlobeSimple} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useCmsLegalIndex, useCmsLegalPage} from "@/lib/cms/content.ts";
import {PROSE_CLASS, renderMarkdown} from "@/lib/cms/markdown.ts";
import {SectionError} from "@/pages/home/components/section-state.tsx";
import {
  ADDRESS_LINE,
  BUSINESS_ACTIVITY,
  CONTACT_EMAIL,
  LEGAL_NAME,
  RUT,
  TRADE_NAME,
} from "@/lib/company.ts";

/**
 * The legal pages, read from the CMS.
 *
 * Which documents exist, what they are called and what they say all come from `/legal` now — the
 * tabs are the API's listing, so publishing a cookie policy in `/cms` puts a third tab here with
 * no deploy. What stays local is the terminal it is dressed as: the typing, the fake `clear`, the
 * truncated transcript of the previous run.
 *
 * The bodies are Markdown, and the reveal that used to step through hand-written clauses now steps
 * through the document's own `##` sections. That keeps the effect honest — it is revealing the
 * real structure of the text rather than a list written to look like one — and it degrades
 * gracefully: a document with no headings is one section that appears at once.
 *
 * What is *not* left to the CMS is who issues these documents. The identity block below the title
 * is rendered from `@/lib/company.ts`, so the razón social, the RUT, the giro and the domicilio are
 * on the page whatever the CMS happens to be serving — and are still on it when the CMS is
 * unreachable, which is the one moment a visitor most needs to know who they were dealing with.
 */

type TerminalPhase = "typing-clear" | "loading-clear" | "typing-command" | "loading-command" | "streaming" | "loaded";
type CommittedRun = {lines: string[]};
type PreviousBlock = {firstLines: string[]; truncatedChars: number};

const CLEAR_CMD = "clear";
const TYPE_CHAR_MS = 35;
const SECTION_REVEAL_MS = 90;
const randomLoadMs = () => 300 + Math.random() * 400;
const randomTruncateExtraMs = () => 400 + Math.random() * 200;

/**
 * Splits a Markdown document at its top-level headings.
 *
 * Anything before the first `##` — an editor's preamble — is kept as a leading section rather than
 * dropped, so no text can go missing just because the document does not open with a heading.
 */
const splitSections = (body: string): string[] =>
  body
    .split(/\n(?=## )/g)
    .map((section) => section.trim())
    .filter(Boolean);

/**
 * The slug in the address bar's fragment, if there is one.
 *
 * Every legal document is served from this one route, so `#privacy-policy` is the only way an
 * outside link can ask for a particular one — and outside links exist: the footer of every email
 * the API sends points at `/legal#terms-of-service` and `/legal#privacy-policy`. Reading it here
 * costs nothing when the fragment is absent, and a slug the CMS does not publish falls through to
 * the first tab like any other unknown value.
 */
const slugFromHash = (hash: string): string | null => {
  const slug = decodeURIComponent(hash.replace(/^#/, "")).trim();
  return slug || null;
};

const toPreviousBlock = ({lines}: CommittedRun): PreviousBlock => {
  const firstLines = lines.slice(0, 4);
  const truncatedChars = lines.slice(4).reduce((sum, line) => sum + line.length, 0);
  return {firstLines, truncatedChars};
};

export const Legal = () => {
  const {t} = useTranslation();
  const {language, toggleLanguage} = useLanguageToggle();
  const [activeSlug, setActiveSlug] = useState<string | null>(() =>
    typeof window === "undefined" ? null : slugFromHash(window.location.hash),
  );
  const [phase, setPhase] = useState<TerminalPhase>("loaded");
  const [clearChars, setClearChars] = useState(CLEAR_CMD.length);
  const [commandChars, setCommandChars] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [previousRun, setPreviousRun] = useState<PreviousBlock | null>(null);
  const committedRun = useRef<CommittedRun | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 0, height: 0});

  const index = useCmsLegalIndex();
  const tabs = useMemo(() => index.data ?? [], [index.data]);

  /* The first published document is the landing tab, whatever the CMS decides that is. */
  const selectedSlug = activeSlug && tabs.some((tab) => tab.slug === activeSlug) ? activeSlug : tabs[0]?.slug ?? null;
  const page = useCmsLegalPage(selectedSlug);

  const command = selectedSlug ? `${t("legal:command")} ${selectedSlug}` : t("legal:command");
  const sections = useMemo(() => (page.data ? splitSections(page.data.body) : []), [page.data]);
  const updated = page.data?.version ? t("legal:updated", {version: page.data.version}) : "";
  const termUser = language === "es" ? "visitante" : "visitor";

  /* The API says which language it actually served; a document with no translation says so. */
  const untranslated = Boolean(page.data && page.data.locale !== language);

  /*
   * The fragment is the tab, in both directions: a link that carries one opens that document, and
   * picking a tab rewrites it so the address in the bar is the address to share. `replaceState`
   * rather than a navigation — a tab is not a page, and it should not cost a back button press.
   */
  const selectSlug = (slug: string) => {
    setActiveSlug(slug);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${slug}`);
    }
  };

  useEffect(() => {
    const onHashChange = () => setActiveSlug(slugFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height)});
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    /* Nothing to type until the document is in hand — the command carries its slug. */
    if (!page.data) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, delay: number) => {
      timers.push(setTimeout(fn, delay));
    };

    setPreviousRun(committedRun.current ? toPreviousBlock(committedRun.current) : null);
    setPhase("typing-clear");
    setClearChars(0);
    setCommandChars(0);
    setRevealedCount(0);

    const clearTypedAt = CLEAR_CMD.length * TYPE_CHAR_MS;
    for (let i = 1; i <= CLEAR_CMD.length; i++) {
      schedule(() => setClearChars(i), i * TYPE_CHAR_MS);
    }
    schedule(() => setPhase("loading-clear"), clearTypedAt);

    const commandStartAt = clearTypedAt + randomLoadMs() + (committedRun.current ? randomTruncateExtraMs() : 0);
    schedule(() => {
      setPhase("typing-command");
      setPreviousRun(null);
    }, commandStartAt);
    for (let i = 1; i <= command.length; i++) {
      schedule(() => setCommandChars(i), commandStartAt + i * TYPE_CHAR_MS);
    }

    const commandTypedAt = commandStartAt + command.length * TYPE_CHAR_MS;
    schedule(() => setPhase("loading-command"), commandTypedAt);

    const streamStartAt = commandTypedAt + randomLoadMs();
    schedule(() => setPhase("streaming"), streamStartAt);
    for (let i = 1; i <= sections.length; i++) {
      schedule(() => setRevealedCount(i), streamStartAt + i * SECTION_REVEAL_MS);
    }
    schedule(() => setPhase("loaded"), streamStartAt + sections.length * SECTION_REVEAL_MS + 50);

    committedRun.current = {lines: [`$ ${CLEAR_CMD}`, `$ ${command}`, updated, ...sections]};

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.data]);

  const revealedSections = phase === "loaded" ? sections : sections.slice(0, revealedCount);
  const streaming = phase === "streaming" || phase === "loaded";

  return (
    <section className="relative w-full overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 pt-32 pb-24 max-w-3xl">
        <div className="flex items-center justify-between mb-10">
          <Button asChild variant="ghost" size="sm" data-fs-hover>
            <Link to="/">
              <ArrowLeft size={16}/>
              {t("legal:back")}
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleLanguage} data-fs-hover>
            <GlobeSimple size={16}/>
            {language === "es" ? "EN" : "ES"}
          </Button>
        </div>

        <p className="text-[13px] uppercase tracking-[0.08em] text-accent-300 mb-3">
          {t("legal:kicker")}
        </p>
        <h1 className="text-[clamp(32px,5.5vw,56px)] text-text mb-8">
          {t("legal:title")}
        </h1>

        {/*
          * The issuer of every document on this page. It sits above the tabs rather than inside the
          * terminal because it is not part of any one document — it identifies the company behind
          * all of them, and it is the same in both languages: only the labels translate, the
          * registered values never do.
          */}
        <section
          aria-labelledby="legal-entity"
          className="mb-10 rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-5 sm:p-6"
        >
          <h2 id="legal-entity" className="text-sm uppercase tracking-[0.08em] text-accent-300 mb-2">
            {t("legal:entity.title")}
          </h2>
          <p className="text-sm text-neutral-400 mb-5">{t("legal:entity.lead")}</p>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-neutral-500">{t("legal:entity.legal_name")}</dt>
            <dd className="text-neutral-300">{LEGAL_NAME}</dd>

            <dt className="text-neutral-500">{t("legal:entity.trade_name")}</dt>
            <dd className="text-neutral-300">{TRADE_NAME}</dd>

            {/* Omitted rather than shown empty: a blank RUT on a legal page is worse than none. */}
            {RUT && (
              <>
                <dt className="text-neutral-500">{t("legal:entity.rut")}</dt>
                <dd className="text-neutral-300">{RUT}</dd>
              </>
            )}

            <dt className="text-neutral-500">{t("legal:entity.activity")}</dt>
            <dd className="text-neutral-300">{BUSINESS_ACTIVITY}</dd>

            <dt className="text-neutral-500">{t("legal:entity.address")}</dt>
            <dd className="text-neutral-300">{ADDRESS_LINE}</dd>

            <dt className="text-neutral-500">{t("legal:entity.email")}</dt>
            <dd>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent-300 hover:text-text transition-colors"
                data-fs-hover
              >
                {CONTACT_EMAIL}
              </a>
            </dd>

            <dt className="text-neutral-500">{t("legal:entity.jurisdiction")}</dt>
            <dd className="text-neutral-300">{t("legal:entity.jurisdiction_value")}</dd>
          </dl>
        </section>

        {index.error ? (
          <SectionError error={index.error} onRetry={index.reload}/>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              {tabs.map((tab) => (
                <Button
                  key={tab.slug}
                  variant={selectedSlug === tab.slug ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => selectSlug(tab.slug)}
                  data-fs-hover
                >
                  {tab.title}
                </Button>
              ))}
            </div>

            <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-surface overflow-hidden">
              <div className="relative flex items-center gap-2 px-4 py-3 bg-neutral-900/70 border-b border-neutral-800">
                <div className="flex gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56]"/>
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"/>
                  <span className="w-3 h-3 rounded-full bg-[#27c93f]"/>
                </div>
                <p className="flex-1 min-w-0 truncate px-2 text-center text-[10px] sm:text-[11px] text-neutral-500 pointer-events-none select-none">
                  {termUser}@franciscosolis.cl — zsh — {size.width}x{size.height}
                </p>
                <div className="w-[52px] shrink-0" aria-hidden="true"/>
              </div>

              <div ref={terminalRef} className="p-4 sm:p-6 font-mono text-xs sm:text-sm min-h-[420px]">
                {previousRun && (
                  <div className="opacity-40 text-neutral-600 mb-4 space-y-0.5">
                    {previousRun.firstLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    <p>[+{previousRun.truncatedChars} truncated]</p>
                  </div>
                )}

                {page.error ? (
                  <SectionError error={page.error} onRetry={page.reload}/>
                ) : !page.data ? (
                  <p className="flex items-center gap-3 text-neutral-500">
                    <Spinner size={14} label={t("common:loading")}/>
                    {t("common:loading")}
                  </p>
                ) : (
                  <>
                    <p className="text-neutral-500 mb-4">
                      $ {CLEAR_CMD.slice(0, clearChars)}
                      {phase === "typing-clear" && <span className="ml-0.5 animate-pulse">▍</span>}
                    </p>
                    {phase !== "typing-clear" && (
                      <p className="text-accent-300 mb-6">
                        $ {command.slice(0, phase === "loading-clear" ? 0 : commandChars)}
                        {phase === "typing-command" && <span className="ml-0.5 animate-pulse">▍</span>}
                      </p>
                    )}

                    {streaming && (
                      <article id={page.data.slug} className="font-sans space-y-2 text-neutral-300">
                        {updated && (
                          <p className="text-neutral-500 text-xs uppercase tracking-[0.08em]">{updated}</p>
                        )}
                        {untranslated && (
                          <p className="text-neutral-500 text-xs">{t("legal:untranslated")}</p>
                        )}
                        {revealedSections.map((section, i) => (
                          <div
                            key={i}
                            className={PROSE_CLASS}
                            dangerouslySetInnerHTML={{__html: renderMarkdown(section)}}
                          />
                        ))}
                      </article>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
